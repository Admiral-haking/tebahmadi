export function FilterText(str: string) {
    if (str.length < 8) return str
    return str.substring(0, 3) + "***" + str.substring(str.length - 3)
}