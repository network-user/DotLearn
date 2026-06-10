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

const clampLimit = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
};

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
  @ApiOperation({ summary: 'Public list of submitted topic proposals.' })
  @ApiQuery({
    name: 'status',
    enum: ['pending', 'approved', 'rejected', 'materialized'],
    required: false,
  })
  async list(@Query('status') status?: string): Promise<SubmissionPublic[]> {
    const parsedStatus = status ? SubmissionStatus.parse(status) : undefined;
    return this.submissions.listPublic(parsedStatus);
  }

  @Get('search')
  @ApiOperation({ summary: 'Fuzzy search across submissions (title, outline, tags).' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async search_(@Query('q') q: string, @Query('limit') limit?: string): Promise<SubmissionPublic[]> {
    if (!q || !q.trim()) {
      return [];
    }
    const hits = await this.search.search(q, clampLimit(limit, DEFAULT_LIMIT));
    return this.submissions.findPublicByIds(hits.map((hit) => hit.id));
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Title autocomplete suggestions.' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async suggest(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ): Promise<SubmissionSuggestion[]> {
    if (!q || !q.trim()) {
      return [];
    }
    const suggestions = await this.search.suggest(q, clampLimit(limit, 8));
    return suggestions.map(({ id, title }) => ({ id, title }));
  }
}
