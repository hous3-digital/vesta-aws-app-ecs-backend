import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

export function handleHttpError(err: any): never {
  const status = err.response?.status;
  const message = err.response?.data || "Unexpected error";

  switch (status) {
    case HttpStatus.BAD_REQUEST:
      throw new BadRequestException(message);
    case HttpStatus.UNAUTHORIZED:
      throw new UnauthorizedException(message);
    case HttpStatus.NOT_FOUND:
      throw new NotFoundException(message);
    case HttpStatus.FORBIDDEN:
      throw new ForbiddenException(message);
    case HttpStatus.CONFLICT:
      throw new ConflictException(message);
    default:
      throw new InternalServerErrorException(message);
  }
}
