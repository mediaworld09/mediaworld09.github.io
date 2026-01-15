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
      // Обработка редиректа
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newUrl = new URL(res.headers.location, url).href;
        console.log(`Редирект ${redirectCount + 1}: ${url} → ${newUrl}`);
        res.resume(); // Освобождаем поток
        resolve(downloadFile(newUrl, redirectCount + 1));
        return;
      }

      // Если не 200 — ошибка
      if (res.statusCode !== 200) {
        reject(new Error(`Ошибка загрузки: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function processPlaylist(dropboxUrl, excludedCategories, outputFile) {
  // Нормализуем категории в массив нижнего регистра
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

    while (i < lines.length) {
      const line = lines[i];

      // Сохраняем заголовок #EXTM3U
      if (i === 0 && line.trim().startsWith('#EXTM3U')) {
        newLines.push(line);
        i++;
        continue;
      }

      // Если это строка #EXTINF
      if (line.trim().startsWith('#EXTINF:')) {
        let shouldSkip = false;

        if (excludedLower.length > 0) {
          // Ищем group-title="..." или group-title='...'
          const groupMatch = line.match(/group-title=["']([^"']+)["']/i);
          if (groupMatch) {
            const group = groupMatch[1].toLowerCase().trim();
            if (excludedLower.includes(group)) {
              shouldSkip = true;
            }
          }
        }

        if (shouldSkip) {
          // Пропускаем #EXTINF и следующую строку (URL канала)
          i += 2;
          removedCount++;
          continue;
        }
      }

      // Сохраняем все остальные строки
      newLines.push(line);
      i++;
    }

    const updatedPlaylist = newLines.join('\n');

    // Убираем возможные лишние пустые строки в конце
    const finalPlaylist = updatedPlaylist.trim() + '\n';

    const fullPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(fullPath, finalPlaylist);

    console.log(`Обновлённый плейлист сохранён в ${outputFile}`);
    console.log(`   Удалено каналов: ${removedCount} (категории: ${excludedLower.join(', ') || 'нет'})`);
  } catch (err) {
    console.error(`Ошибка при обработке ${dropboxUrl}:`, err);
  }
}

async function main() {
  // === ЗДЕСЬ ДОБАВЛЯЙТЕ СВОИ ПЛЕЙЛИСТЫ ===
  // Пример вызова:
  await processPlaylist(
    'https://www.dropbox.com/s/sfcqivm9jtq279g/RO$TIK_TV.m3u?raw=1',
    'LOVE 🔞',                                   // одна категория (строка)
    'R$_TV.m3u'
  );

  await processPlaylist(
    'https://tva.in.ua/iptv/s/avto.m3u?raw=1',
    '♥18+',                                   // одна категория (строка)
    'auto.m3u'
  );

  await processPlaylist(
    'https://linkspile.su/iptv/p/dmZ3L634vSWAaL/Sharavoz.Tv.navigator-ott.m3u?raw=1',
    'XXX Adult',                                   // одна категория (строка)
    'Sharovoz-TV.m3u'
  );

  await processPlaylist(
    'https://m3url.ru/iptv.online__(2).m3u',
    'Для взрослых',                                   // одна категория (строка)
    'm3url-tv.m3u'
  );

  // Добавьте столько вызовов, сколько нужно
  // =========================================

  console.log('Все плейлисты обработаны');
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
