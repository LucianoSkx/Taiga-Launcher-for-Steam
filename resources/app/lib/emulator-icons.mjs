// Ícones locais de fallback: um glifo simples por família de emulador, para o card nunca cair nas iniciais.
const COLORS = {
 psp: '#2f6df6', ps2: '#1e5ed6', ps3: '#2b74d8', ps1: '#e26a3c', dolphin: '#1aa7e0',
 cemu: '#e07b2c', xenia: '#1f9d63', mgba: '#3f7bd8', melonds: '#8f5bd8', retroarch: '#d94a4a',
 vita3k: '#2b8fd6', shadps4: '#2e6fd0', switch: '#e04545', azahar: '#3aa0c8', flycast: '#c65ad8',
 redream: '#d4487a', xemu: '#2f9a55', mesen: '#4a9b5e', snes9x: '#5a6bd8', project64: '#7b5bd8',
 mame: '#d08a2c', bizhawk: '#c05a3c', ares: '#5e8f52', mednafen: '#8a6bd8', stella: '#d0a12c',
 fusion: '#3c86c0', dosbox: '#6b7280'
};
const GLYPHS = {
 psp: '<rect x="22" y="24" width="20" height="16" rx="4"/><circle cx="27" cy="32" r="2.5" fill="C"/><circle cx="37" cy="32" r="2.5" fill="C"/>',
 ps2: '<path d="M24 22l16 20M40 22L24 42" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
 ps3: '<circle cx="32" cy="32" r="11"/><circle cx="32" cy="32" r="4" fill="C"/>',
 ps1: '<circle cx="32" cy="32" r="11"/><path d="M27 32h10M32 27v10" stroke="C" stroke-width="3"/>',
 dolphin: '<path d="M18 40c8-2 12-12 24-16-4 8-10 14-18 16z"/><circle cx="44" cy="23" r="2" fill="C"/>',
 retroarch: '<path d="M20 32h6l4-8 5 16 4-8h6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
 switch: '<rect x="19" y="26" width="11" height="14" rx="2"/><rect x="34" y="26" width="11" height="14" rx="2"/><circle cx="24" cy="31" r="2" fill="C"/><circle cx="41" cy="35" r="2" fill="C"/>',
 mesen: '<path d="M22 40l6-14 4 9 4-9 6 14" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/>',
 mame: '<path d="M24 40V24h16v16zM28 28h8v8h-8z" fill="#fff" fill-rule="evenodd"/>',
 dosbox: '<rect x="20" y="24" width="24" height="16" rx="2"/><rect x="24" y="28" width="16" height="8" fill="C"/>'
};
const fallbackGlyph = '<rect x="17" y="27" width="30" height="16" rx="7"/><circle cx="24" cy="35" r="2.5" fill="C"/><circle cx="31" cy="35" r="2.5" fill="C"/><circle cx="39" cy="31" r="2.5" fill="C"/><circle cx="44" cy="36" r="2.5" fill="C"/>';
export function emulatorFallbackIcon(profile) {
 const color = COLORS[profile]; if (!color) return null;
 const glyph = (GLYPHS[profile] || fallbackGlyph).replace(/C/g, color);
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><g fill="#fff">${glyph}</g></svg>`);
}
