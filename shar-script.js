const fs = require('fs');

const filePath = 'https://mediaworld09.github.io/Sharovoz-TV.m3u';

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return console.error('Ошибка чтения:', err);

    let isModified = false;
    const lines = data.split(/\r?\n/);

    const updatedLines = lines.map(line => {
        if (!isModified && line.startsWith('#EXTINF:')) {
            const commaIndex = line.indexOf(',');
            if (commaIndex !== -1) {
                isModified = true; // Меняем только первый канал
                return line.slice(0, commaIndex + 1) + ' ' + line.slice(commaIndex + 1);
            }
        }
        return line;
    });

    fs.writeFile(filePath, updatedLines.join('\n'), 'utf8', (err) => {
        if (err) console.error('Ошибка записи:', err);
        else console.log('Готово! Пробел добавлен для первого канала.');
    });
});
