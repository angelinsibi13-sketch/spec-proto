export function tidySpeech(text: string): string {
  let value = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?…])/g, "$1")
    .replace(/([,.;:!?…])(?=[^\s])/g, "$1 ")
    .replace(/(^|[^а-яёa-z])кп(?=$|[^а-яёa-z])/gi, "$1КП")
    .replace(/(^|[^а-яёa-z])([а-яё]{2,})\s+\2(?=$|[^а-яёa-z])/gi, "$1$2")
    .trim();
  if (!value) return value;
  value = value.replace(/(^|[.!?…]\s+)([а-яёa-z])/gi, (full, prefix: string, letter: string) => {
    return `${prefix}${letter.toLocaleUpperCase("ru-RU")}`;
  });
  if (!/[.!?…]$/.test(value)) value = `${value}.`;
  return value;
}
