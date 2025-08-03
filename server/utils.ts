export function generateRoomId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}`; // e.g., "k9a2-h7xq"
}

export function generateRandomName() {
    const animals = ['Fox', 'Panda', 'Dolphin', 'Koala', 'Tiger', 'Eagle'];
    const id = Math.floor(Math.random() * 1000);
    return animals[Math.floor(Math.random() * animals.length)] + '-' + id;
}