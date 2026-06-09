import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  MarkMaterializedInput,
  ReviewSubmissionInput,
  type Submission,
  SubmissionStatus,
} from '@dotlearn/contracts';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { SubmissionsSearchIndexer } from '../search/submissions-search.indexer';
import { SubmissionsService } from './submissions.service';

@ApiTags('admin')
@Controller('admin/submissions')
export class AdminSubmissionsController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly indexer: SubmissionsSearchIndexer,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List submissions, optionally filtered by status.' })
  @ApiQuery({
    name: 'status',
    enum: ['pending', 'approved', 'rejected', 'materialized'],
    required: false,
  })
  async list(@Query('status') status?: string): Promise<Submission[]> {
    const parsedStatus = status ? SubmissionStatus.parse(status) : undefined;
    return this.submissions.list(parsedStatus);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a pending submission.' })
  @UsePipes(new ZodBodyPipe(ReviewSubmissionInput))
  async review(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ReviewSubmissionInput,
  ): Promise<Submission> {
    const result = await this.submissions.review(id, body);
    await this.indexer.indexOne(id);
    return result;
  }

  @Post(':id/materialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an approved submission as materialized (topic added to repo).' })
  @UsePipes(new ZodBodyPipe(MarkMaterializedInput))
  async materialize(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MarkMaterializedInput,
  ): Promise<Submission> {
    const result = await this.submissions.markMaterialized(id, body);
    await this.indexer.indexOne(id);
    return result;
  }
}
