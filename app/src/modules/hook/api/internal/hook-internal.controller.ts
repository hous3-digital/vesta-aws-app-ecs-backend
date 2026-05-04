import { Body, Controller, HttpStatus, Post, Req } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiExcludeController } from "@nestjs/swagger";
import { HookInternalProcessVeriffCommand } from "@src/modules/hook/application/internal/commands/hook-internal-process-veriff.command";
import { Request } from "express";

@ApiExcludeController()
@Controller("hooks")
export class HookInternalController {
  public constructor(private readonly commandBus: CommandBus) {}

  @Post("veriff")
  public async veriff(@Body() input: any, @Req() request: Request): Promise<HttpStatus> {
    const ip = request.headers["x-forwarded-for"] || request.socket.remoteAddress;
    const command = new HookInternalProcessVeriffCommand(
      request.method,
      request.protocol,
      request.host,
      request.path,
      input,
      ip,
      request.statusCode,
    );
    await this.commandBus.execute<HookInternalProcessVeriffCommand, void>(command);
    return HttpStatus.OK;
  }
}
