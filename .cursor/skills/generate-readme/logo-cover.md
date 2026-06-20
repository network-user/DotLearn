# Обложка - SVG в стиле DotBioSite

Агент **пишет SVG как текст** - это не вызов image API. Эстетика monochrome 2D DotBioSite (`public/projects/*/cover.svg`): тёмный градиент, тонкая сетка, line-art глиф 48×48, бренд + имя + tagline.

## Режим по среде просмотра

| Где смотрят README                                                  | Обложка                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **github.com / GitLab** (режут inline `<svg>` при рендере markdown) | агент пишет ту же SVG в `docs/cover.svg` и ставит `<img src="docs/cover.svg" width="720">`; файл создаётся и коммитится в этом же изменении |
| **IDE-превью, Obsidian, npm, портфолио** (рендерят inline)          | inline `<svg>` в теле README, сразу после badges                                                                                            |
| **В репо уже есть** `docs/preview.png` / скриншот                   | `<img src="docs/preview.png" width="720">`, новую обложку не делать                                                                         |
| **Есть image generation** и пользователь просит скрин/фото          | raster PNG → `docs/preview.png` + `<img>`; иначе SVG                                                                                        |

Default для проектов на GitHub - `docs/cover.svg` + `<img>` (рендерится и в IDE, и на github.com). Чисто-IDE/портфолио репозиторий - inline `<svg>`.

Жёстко: никогда не ссылайся `<img src>` на файл, которого нет в репо. Имя `docs/readme-hero.svg` не используем - это легаси-битая ссылка из прошлой версии скилла.

## Правила SVG

- `viewBox="0 0 1600 900"` (16:9), `role="img"`, `aria-label="{name}"`.
- В README через `<img>`: ширина задаётся `width="720"` на теге `<img>`. Inline в теле: `width="720"` на самом `<svg>`.
- `id` градиентов с префиксом проекта: `dl-bg`, `dl-glow` (не голые `bg`/`glow` - конфликтуют при нескольких SVG на странице).
- Без `<script>`, без внешних `href`/`xlink:href`, без `foreignObject`, без `<use>` (часть санитайзеров их режет).
- UTF-8 в `<text>`. **Весь видимый текст на русском:** brand (`.учёба`, `.счёт`), tagline - одна строка на русском. Имя проекта латиницей допустимо (`DotLearn`, `code-counter`). **Запрещено** писать tagline на английском «по умолчанию» или «для GitHub».
- Перед inline-обложкой комментарий `<!-- cover: DotBioSite, inline -->` для поиска при регенерации.

## Design tokens

| Элемент               | Значение                                                  |
| --------------------- | --------------------------------------------------------- |
| Фон                   | linear `#0a0b0d` → `#14161a` (полный: → `#0b0c0e`)        |
| Glow                  | radial white, opacity 0 → 0.12-0.14, центр сверху-справа  |
| Сетка                 | stroke white, opacity 0.045-0.05                          |
| Halo (полный вариант) | radial white circle r≈330 справа                          |
| Глиф                  | stroke `#f3f3f1`, width 2.6, viewBox 48×48                |
| Watermark-глиф        | крупная копия глифа справа, opacity 0.1, stroke `#ffffff` |
| Brand                 | 132px, weight 800, `#f3f3f1`                              |
| Name                  | 34px, weight 700, `#f3f3f1`                               |
| Tagline               | 26px, `#a6a7ab`                                           |

Только monochrome. Без UI-мокапов, macOS-точек, accent-цветов.

## Библиотека глифов (48×48)

| Проект / тип    | Motif           |
| --------------- | --------------- |
| Learning        | graduation cap  |
| Bot / math      | + − × ÷         |
| Work bot        | briefcase       |
| CLI / agents    | terminal prompt |
| Network / trace | nodes + edges   |
| Audio           | equalizer bars  |

Graduation cap (для DotLearn):

```xml
<path d="M5 19 L24 10 L43 19 L24 28 Z"/>
<path d="M13 22.5 V31 q11 6 22 0 V22.5"/>
<path d="M43 19 V29"/>
<circle cx="43" cy="31.5" r="1.6" fill="#f3f3f1" stroke="none"/>
```

В watermark-копии глифа цвет обводки и заливки `circle` - `#ffffff` (под цвет stroke группы).

## Skeleton - компактный inline (default для IDE)

~26 строк. Замени `{p}` (префикс id), `{brand}`, `{name}`, `{tagline}`, `{glyph}` (paths из библиотеки выше). Halo опущен ради компактности.

```xml
<!-- cover: DotBioSite, inline -->
<svg xmlns="http://www.w3.org/2000/svg" width="720" viewBox="0 0 1600 900" role="img" aria-label="{name}">
  <defs>
    <linearGradient id="{p}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0b0d"/>
      <stop offset="1" stop-color="#14161a"/>
    </linearGradient>
    <radialGradient id="{p}-glow" cx="72%" cy="22%" r="60%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#{p}-bg)"/>
  <rect width="1600" height="900" fill="url(#{p}-glow)"/>
  <g opacity="0.05" stroke="#ffffff" stroke-width="1">
    <path d="M0 300H1600M0 600H1600M533 0V900M1067 0V900"/>
  </g>
  <svg x="980" y="250" width="400" height="400" viewBox="0 0 48 48">
    <g opacity="0.1" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>
  </svg>
  <svg x="140" y="120" width="86" height="86" viewBox="0 0 48 48">
    <g fill="none" stroke="#f3f3f1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>
  </svg>
  <text x="138" y="408" font-family="Inter, Arial, sans-serif" font-size="132" font-weight="800" fill="#f3f3f1" letter-spacing="-3">{brand}</text>
  <text x="146" y="470" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#f3f3f1">{name}</text>
  <text x="146" y="516" font-family="Inter, Arial, sans-serif" font-size="26" fill="#a6a7ab">{tagline}</text>
</svg>
```

## Skeleton - полный для `docs/cover.svg` (default для GitHub)

Standalone-файл не ограничен длиной README, поэтому здесь добавлен halo и трёхстоповый фон. Без `width="720"` на `<svg>` (размер задаст `<img width="720">`). Тот же файл ссылается из README: `<img src="docs/cover.svg" width="720" alt="{name}" />`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="{name}">
  <title>{name}</title>
  <defs>
    <linearGradient id="{p}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0b0d"/>
      <stop offset="0.5" stop-color="#14161a"/>
      <stop offset="1" stop-color="#0b0c0e"/>
    </linearGradient>
    <radialGradient id="{p}-glow" cx="70%" cy="20%" r="62%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="{p}-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#{p}-bg)"/>
  <rect width="1600" height="900" fill="url(#{p}-glow)"/>
  <g opacity="0.045" stroke="#ffffff" stroke-width="1">
    <path d="M0 225 H1600 M0 450 H1600 M0 675 H1600 M400 0 V900 M800 0 V900 M1200 0 V900"/>
  </g>
  <circle cx="1180" cy="460" r="330" fill="url(#{p}-halo)"/>
  <svg x="965" y="245" width="430" height="430" viewBox="0 0 48 48">
    <g opacity="0.1" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{glyph-white}</g>
  </svg>
  <svg x="140" y="118" width="86" height="86" viewBox="0 0 48 48">
    <g fill="none" stroke="#f3f3f1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>
  </svg>
  <text x="138" y="408" font-family="Inter, Arial, sans-serif" font-size="132" font-weight="800" fill="#f3f3f1" letter-spacing="-3">{brand}</text>
  <text x="146" y="470" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#f3f3f1">{name}</text>
  <text x="146" y="516" font-family="Inter, Arial, sans-serif" font-size="26" fill="#a6a7ab">{tagline}</text>
</svg>
```

## Если есть image generation

Только по явной просьбе («скриншот», «фото UI»): PNG → `docs/preview.png` → `<img src="docs/preview.png" width="720">`. Иначе SVG - дешевле и самодостаточен.

Raster prompt (fallback):

```
Minimalist monochrome 2D portfolio cover, 16:9, dark charcoal gradient #0a0b0d to #14161a,
subtle white grid 5% opacity, white line-art icon, bold white brand text, gray tagline,
flat vector, no 3D, no colors.
```

## Чеклист обложки

- [ ] Режим выбран по среде просмотра (GitHub → `docs/cover.svg`+`<img>`; IDE → inline).
- [ ] Если `<img>` на файл - файл создан и закоммичен; нет ссылок на `docs/readme-hero.svg`.
- [ ] Monochrome DotBioSite layout, глиф из библиотеки.
- [ ] Префиксованные `id` градиентов, без `<script>`/`<use>`/внешних href.
