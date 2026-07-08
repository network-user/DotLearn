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
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  MarkMaterializedInput,
  ReviewSubmissionInput,
  type Submission,
  SubmissionStatus,
} from '@dotlearn/contracts';

import type { AdminActor } from '../../common/audit/admin-actor';
import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { RequireStepUp } from '../auth/decorators/require-step-up.decorator';
import type { AuthenticatedRequest } from '../auth/guards/admin-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { StepUpGuard } from '../auth/guards/step-up.guard';
import type { SubmissionsSearchIndexer } from '../search/submissions-search.indexer';
import type { SubmissionsService } from './submissions.service';

const actorFrom = (request: AuthenticatedRequest): AdminActor => ({
  jti: request.admin?.jti ?? 'unknown',
  ip: request.ip ?? 'unknown',
});

@ApiTags('admin')
@Controller('admin/submissions')
@UseGuards(AdminAuthGuard, StepUpGuard)
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
  @RequireStepUp('submissions.review')
  @ApiOperation({ summary: 'Approve or reject a pending submission.' })
  @UsePipes(new ZodBodyPipe(ReviewSubmissionInput))
  async review(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ReviewSubmissionInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<Submission> {
    const result = await this.submissions.review(id, body, actorFrom(request));
    await this.indexer.indexOne(id);
    return result;
  }

  @Post(':id/materialize')
  @HttpCode(HttpStatus.OK)
  @RequireStepUp('submissions.materialize')
  @ApiOperation({ summary: 'Mark an approved submission as materialized (topic added to repo).' })
  @UsePipes(new ZodBodyPipe(MarkMaterializedInput))
  async materialize(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MarkMaterializedInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<Submission> {
    const result = await this.submissions.markMaterialized(id, body, actorFrom(request));
    await this.indexer.indexOne(id);
    return result;
  }
}
