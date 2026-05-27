import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';

@Controller('ai')
export class AiController {
  private readonly aiServiceUrl = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

  private resolveAiBaseUrl(): string {
    if (!this.aiServiceUrl) {
      throw new BadRequestException('AI_SERVICE_URL is not configured');
    }

    return this.aiServiceUrl;
  }

  private async forwardRequest(
    path: string,
    method: 'GET' | 'POST',
    query: Record<string, string | string[] | undefined>,
    body?: unknown,
  ) {
    const baseUrl = this.resolveAiBaseUrl();
    const url = new URL(`${baseUrl}${path}`);

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else {
        url.searchParams.set(key, String(value));
      }
    });

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method !== 'GET' && body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      throw new BadGatewayException(`AI service error (${response.status}): ${message}`);
    }

    return payload;
  }

  @Get('search')
  async searchGet(@Query() query: Record<string, string | string[] | undefined>) {
    return this.forwardRequest('/search', 'GET', query);
  }

  @Post('search')
  async searchPost(
    @Query() query: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    return this.forwardRequest('/search', 'POST', query, body);
  }

  @Post('chat')
  async chat(@Body() body: { message?: string }) {
    return this.forwardRequest('/chat', 'POST', {}, body);
  }
}
