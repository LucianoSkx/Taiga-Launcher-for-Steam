// Biblioteca da GOG pela conta conectada no programa (os mesmos endpoints que o GOG Galaxy usa).
// O login guarda os cookies da sessão; nenhuma senha é armazenada.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
export function gogCookieHeader(auth) {
 return (auth?.cookies || []).filter(c => /gog\.com$/i.test(String(c.domain || '').replace(/^\./, '')))
  .map(c => `${c.name}=${c.value}`).join('; ');
}
const image = url => { const s = String(url || ''); if (!s) return ''; return s.startsWith('//') ? 'https:' + s : s; };
export async function gogLibrary(auth, { fetchImpl = (...a) => fetch(...a), language = 'pt-BR' } = {}) {
 if (!auth?.username) throw Error('Entre com a sua conta GOG em Contas.');
 const cookie = gogCookieHeader(auth); if (!cookie) throw Error('A sessão da GOG expirou. Entre de novo em Contas.');
 const all = []; let page = 1, pages = 1;
 while (page <= pages && page <= 100) {
  const url = `https://www.gog.com/u/${encodeURIComponent(auth.username)}/games/stats?sort=title&order=asc&page=${page}`;
  const r = await fetchImpl(url, {headers: {Cookie: cookie, 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': language}, signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw Error('A GOG respondeu HTTP ' + r.status + '.');
  const data = await r.json().catch(() => null); if (!data) break;
  for (const it of data?._embedded?.items || []) {
   const id = String(it?.game?.id || ''), title = String(it?.game?.title || '').trim();
   if (!id || !title) continue;
   const img = image(it.game.image);
   all.push({store: 'gog', storeName: 'GOG', id, title, url: it.game.url || '', images: {cover: img, wide: img}});
  }
  pages = Math.max(1, Number(data.pages) || 1); page++;
 }
 return all;
}
