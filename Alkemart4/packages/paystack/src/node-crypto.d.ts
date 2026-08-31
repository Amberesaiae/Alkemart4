declare module "node:crypto" {
  export function createHmac(
    algorithm: string,
    key: string,
  ): {
    update(data: string): { digest(encoding: "hex"): string }
  }
}
