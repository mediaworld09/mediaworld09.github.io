const fs = require('fs');
const path = require('path');

function processLocalPlaylist(filePath, excludedCategories = []) {
  // Нормализуем категории в массив нижнего регистра (с trim)
  const excludedLower = Array.isArray(excludedCategories)
    ? excludedCategories.map(c => c.toLowerCase().trim())
    : (typeof excludedCategories === 'string' ? [excludedCategories.toLowerCase().trim()] : []);

  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const playlistText = fs.readFileSync(fullPath, 'utf8');

    const lines = playlistText.split('\n');
    const newLines = [];
    let removedCount = 0;
    let fixedCount = 0;
    let i = 0;

    while (i < lines.length) {
      let line = lines[i];

      // Сохраняем заголовок #EXTM3U без изменений
      if (i === 0 && line.trim().startsWith('#EXTM3U')) {
        newLines.push(line);
        i++;
        continue;
      }

      // Если это строка #EXTINF
      if (line.trim().startsWith('#EXTINF:')) {
        let shouldSkip = false;
        let normalizedLine = line;

        // 1. Проверяем group-title на удаление
        if (excludedLower.length > 0) {
          const groupMatch = line.match(/group-title=["']([^"']*)["']/i);
          if (groupMatch) {
            const group = groupMatch[1].toLowerCase().trim();
            if (excludedLower.includes(group)) {
              shouldSkip = true;
              removedCount++;
            }
          }
        }

        if (shouldSkip) {
          // Пропускаем #EXTINF и следующую строку (URL канала)
          i += 2;
          continue;
        }

        // 2. Если канал не удаляется — исправляем лишний пробел перед запятой
        const fixedLine = normalizedLine.replace(/\s+,/g, ','); // убирает все пробелы перед запятой
        if (fixedLine !== normalizedLine) {
          fixedCount++;
          normalizedLine = fixedLine;
        }

        newLines.push(normalizedLine);
        i++;
        continue;
      }

      // Все остальные строки (URL каналов, комментарии и т.д.) сохраняем как есть
      newLines.push(line);
      i++;
    }

    const updatedPlaylist = newLines.join('\n').trim() + '\n';

    // Перезаписываем тот же файл
    fs.writeFileSync(fullPath, updatedPlaylist);

    console.log(`Обработан файл: ${filePath}`);
    console.log(`   Удалено каналов: ${removedCount}`);
    console.log(`   Исправлено строк #EXTINF (убран пробел перед запятой): ${fixedCount}`);
  } catch (err) {
    console.error(`Ошибка при обработке ${filePath}:`, err);
  }
}

async function main() {
  // === ЗДЕСЬ УКАЖИТЕ СВОИ ФАЙЛЫ И КАТЕГОРИИ ===
  // Формат: { file: 'имя_файла.m3u', excluded: ['Adult', 'XXX', 'Эротика'] }
  // Если ничего удалять не нужно — укажите пустой массив []

  const playlistsToClean = [
    {
      file: 'R$_TV.m3u',
      excluded: ['LOVE 🔞']  // добавьте все варианты, которые могли остаться
    },
    {
      file: 'Sharovoz-TV.m3u',
      excluded: []  // только исправление пробелов, без удаления
    },
    // Добавьте столько файлов, сколько нужно
  ];

  for (const { file, excluded } of playlistsToClean) {
    processLocalPlaylist(file, excluded);
  }

  console.log('Все указанные плейлисты очищены');
}

main();
