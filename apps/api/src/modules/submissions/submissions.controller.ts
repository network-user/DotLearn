import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CreateSubmissionInput,
  type Submission,
  type SubmissionPublic,
  SubmissionStatus,
  type SubmissionSuggestion,
} from '@dotlearn/contracts';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { SEARCH_SERVICE, type SearchService } from '../search/search.service';
import { SubmissionsService } from './submissions.service';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_QUERY_LENGTH = 128;
const READ_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

const clampLimit = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
};

const clampOffset = (raw: string | undefined): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const boundQuery = (q: string | undefined): string => (q ?? '').slice(0, MAX_QUERY_LENGTH);

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly submissions: SubmissionsService,
    @Inject(SEARCH_SERVICE) private readonly search: SearchService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a topic proposal from the in-app form.' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Created.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @UsePipes(new ZodBodyPipe(CreateSubmissionInput))
  async create(@Body() body: CreateSubmissionInput): Promise<Submission> {
    return this.submissions.create(body, 'in-app');
  }

  @Get()
  @Throttle(READ_THROTTLE)
  @ApiOperation({ summary: 'Public list of submitted topic proposals.' })
  @ApiQuery({
    name: 'status',
    enum: ['pending', 'approved', 'rejected', 'materialized'],
    required: false,
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<SubmissionPublic[]> {
    const parsedStatus = status ? SubmissionStatus.parse(status) : undefined;
    return this.submissions.listPublic(parsedStatus, {
      limit: clampLimit(limit, MAX_LIMIT),
      offset: clampOffset(offset),
    });
  }

  @Get('search')
  @Throttle(READ_THROTTLE)
  @ApiOperation({ summary: 'Fuzzy search across submissions (title, outline, tags).' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async search_(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<SubmissionPublic[]> {
    const query = boundQuery(q);
    if (!query.trim()) {
      return [];
    }
    const hits = await this.search.search(query, clampLimit(limit, DEFAULT_LIMIT));
    return this.submissions.findPublicByIds(hits.map((hit) => hit.id));
  }

  @Get('suggest')
  @Throttle(READ_THROTTLE)
  @ApiOperation({ summary: 'Title autocomplete suggestions.' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async suggest(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<SubmissionSuggestion[]> {
    const query = boundQuery(q);
    if (!query.trim()) {
      return [];
    }
    const suggestions = await this.search.suggest(query, clampLimit(limit, 8));
    return suggestions.map(({ id, title }) => ({ id, title }));
  }
}
