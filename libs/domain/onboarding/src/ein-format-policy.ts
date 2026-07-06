const EIN_FORMAT = /^\d{2}-\d{7}$/;

export function isValidEinFormat(ein: string): boolean {
  return EIN_FORMAT.test(ein);
}
