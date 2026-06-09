import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateSubmissionInput, type Submission } from '@dotlearn/contracts';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a topic proposal from the in-app form.' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Created.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @UsePipes(new ZodBodyPipe(CreateSubmissionInput))
  async create(@Body() body: CreateSubmissionInput): Promise<Submission> {
    return this.submissions.create(body, 'in-app');
  }
}
