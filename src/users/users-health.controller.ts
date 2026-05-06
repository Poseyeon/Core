import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Health')
@Controller()
export class UsersHealthController {
  constructor(private readonly usersService: UsersService) {}

  @Get('health')
  @ApiOperation({ summary: 'General health check endpoint' })
  @ApiResponse({
    status: 200,
    schema: { example: { status: 'ok', port: 3000 } },
  })
  health() {
    return this.usersService.getHealth();
  }

  @Get('api/health')
  @ApiOperation({ summary: 'API health check endpoint' })
  @ApiResponse({
    status: 200,
    schema: { example: { status: 'ok', port: 3000 } },
  })
  apiHealth() {
    return this.usersService.getHealth();
  }
}
