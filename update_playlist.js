const fs = require('fs');
const https = require('https');
const path = require('path');

async function downloadFile(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow',          // автоматически следовать редиректам
      signal: AbortSignal.timeout(30000) // таймаут 30 сек (опционально, чтобы не висело вечно)
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки: HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Таймаут при загрузке плейлиста');
    }
    throw err; // пробрасываем дальше
  }
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
  // await processPlaylist(
  //   'https://www.dropbox.com/s/sfcqivm9jtq279g/RO$TIK_TV.m3u?raw=1',
  //   'LOVE 🔞',                                   // одна категория (строка)
  //   'R$_TV.m3u'
  // );

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

  await processPlaylist(
    'https://u.vipl.one/high/9i7mez8jhs/playlist.m3u8?raw=1',
    ' ',                             // одна категория (строка)
    'VIPL_ONE.m3u'
  );

  // Добавьте столько вызовов, сколько нужно
  // =========================================

  console.log('Все плейлисты обработаны');
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
