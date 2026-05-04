export class HookInternalProcessVeriffCommand {
  public constructor(
    public readonly method: string,
    public readonly protocol: string,
    public readonly host: string,
    public readonly path: string,
    public readonly body?: any,
    public readonly ip?: string | string[],
    public readonly statusCode?: number,
  ) {}
}
