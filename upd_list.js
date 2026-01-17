const fs = require('fs');
const https = require('https');
const path = require('path');

async function downloadFile(url, redirectCount = 0) {
  if (redirectCount > 10) {
    throw new Error('Слишком много редиректов');
  }

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Node.js script)'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newUrl = new URL(res.headers.location, url).href;
        console.log(`Редирект ${redirectCount + 1}: ${url} → ${newUrl}`);
        res.resume();
        resolve(downloadFile(newUrl, redirectCount + 1));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Ошибка загрузки: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function processPlaylist(dropboxUrl, excludedCategories, outputFile) {
  let excludedLower = [];
  if (typeof excludedCategories === 'string' && excludedCategories.trim() !== '') {
    excludedLower = [excludedCategories.toLowerCase().trim()];
  } else if (Array.isArray(excludedCategories)) {
    excludedLower = excludedCategories
      .filter(c => typeof c === 'string' && c.trim() !== '')
      .map(c => c.toLowerCase().trim());
  }

  try {
    console.log(`Скачиваем плейлист: ${dropboxUrl}`);
    const playlistText = await downloadFile(dropboxUrl);

    const lines = playlistText.split('\n');
    const newLines = [];
    let removedCount = 0;
    let i = 0;

    // Добавляем заголовок
    if (lines.length > 0 && lines[0].trim().startsWith('#EXTM3U')) {
      newLines.push(lines[0].trim());
      newLines.push(''); // пустая строка после заголовка для красоты
      i = 1;
    }

    while (i < lines.length) {
      let currentLine = lines[i].trimEnd(); // убираем только конечные пробелы/табы

      // Пропускаем пустые строки и комментарии
      if (currentLine === '' || currentLine.startsWith('#') && !currentLine.startsWith('#EXTINF:')) {
        i++;
        continue;
      }

      // Обрабатываем #EXTINF
      if (currentLine.startsWith('#EXTINF:')) {
        let shouldSkip = false;

        // Извлекаем и очищаем group-title
        const groupMatch = currentLine.match(/group-title=["']([^"']*)["']/i);
        let groupValue = '';
        if (groupMatch) {
          groupValue = groupMatch[1].trim().toLowerCase();
          if (excludedLower.includes(groupValue)) {
            shouldSkip = true;
            removedCount++;
          }
        }

        if (shouldSkip) {
          // Пропускаем #EXTINF и следующую строку (URL)
          i += 2;
          continue;
        }

        // Исправляем лишний пробел перед запятой в названии канала
        let fixedLine = currentLine.replace(/\s+,/g, ',');

        // Добавляем отформатированную #EXTINF
        newLines.push(fixedLine);

        // Добавляем URL канала (следующая строка)
        i++;
        if (i < lines.length) {
          const urlLine = lines[i].trimEnd();
          if (urlLine && !urlLine.startsWith('#')) {
            newLines.push(urlLine);
          }
        }

        // Добавляем пустую строку между каналами для аккуратности
        newLines.push('');
      }

      i++;
    }

    // Убираем возможную лишнюю пустую строку в конце
    let updatedPlaylist = newLines.join('\n').replace(/\n+$/, '\n');

    const fullPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(fullPath, updatedPlaylist);

    console.log(`Обновлённый плейлист сохранён в ${outputFile}`);
    console.log(`   Удалено каналов: ${removedCount}`);
    console.log(`   Плейлист структурирован: каждая пара #EXTINF + URL подряд, с пустой строкой между каналами`);
  } catch (err) {
    console.error(`Ошибка при обработке ${dropboxUrl}:`, err);
  }
}

async function main() {
  // === ДОБАВЬТЕ СВОИ ПЛЕЙЛИСТЫ ЗДЕСЬ ===
  // await processPlaylist(
  //   'https://www.dropbox.com/s/ВАШ_ИД/playlist1.m3u?raw=1',
  //   ['Adult', 'XXX', '18+', 'Эротика'],
  //   'clean_playlist1.m3u'
  // );

  await processPlaylist(
    'https://www.dropbox.com/s/sfcqivm9jtq279g/RO$TIK_TV.m3u?raw=1',
    'LOVE 🔞',                                   // одна категория (строка)
    'R$_TV.m3u'
  );

  // Добавьте сколько нужно

  console.log('Все плейлисты обработаны и структурированы');
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
