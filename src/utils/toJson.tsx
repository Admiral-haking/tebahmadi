export default function ToJson(object: any) {
    const string = JSON.stringify(object);
    const parsed = JSON.parse(string);
    return parsed
}