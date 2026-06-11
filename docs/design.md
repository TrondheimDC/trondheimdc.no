# TDC Designsystem – DESIGN.md

> **Versjon:** 6.0 · **Sist oppdatert:** 10. juni 2026
> **Figma-fil (kilde til sannhet):** https://www.figma.com/design/t28R8eZgLhRhgBWx4ZKRg0/TDC-Designsystem
>
> Dokumentasjonen speiler eksakt det som finnes i Figma-filen.
> **Alle tokens er definert i Figma først** – DESIGN.md er dokumentasjonen.

---

## Prinsipp: Enkelt å bruke og vedlikeholde

En ny designer eller utvikler skal forstå hele designsystemet etter én lesing av denne filen.

**Navngivning:**
- Alle navn følger Figma-paths (Figma er autoritet): `Color/Green/Green 1`, `BG/Base`, `Spacing/4`
- CSS custom properties genereres fra Figma-navn: `--color-green-1`, `--color-bg-base`, `--spacing-4`
- **Figma er kilden til sannhet** – denne dokumentasjonen reflekterer hva som finnes i Figma

**Vedlikehold:**
- Legg til tokens i Figma først
- Oppdater DESIGN.md for å reflektere Figma (ingen motsatt retning)
- Hvis noe ikke finnes i Figma → fjern det fra DESIGN.md
- Hvert år: gå gjennom og slett tokens som ikke brukes

---

## Token-lagmodell

```
Figma: TDC primaries   →   TDC semantic   →   CSS custom property
─────────────────────────────────────────────────────────────────
Color/Green/Green 1    →   FG/Brand       →   --color-fg-brand
Color/Neutrals/Black   →   BG/Base        →   --color-bg-base
Spacing/4             →   (direkte)      →   --spacing-4
```

**Regler:**
- **Alle tokens er definert i Figma først** – dette er kilden til sannhet
- Komponenter bruker alltid **semantiske tokens** (BG/Base, FG/Brand, osv.)
- Semantiske tokens er navngitt etter **rolle**, ikke visuell verdi
- Primitive tokens endres aldri direkte i komponenter – kun gjennom semantiske aliases
- Endrer du en primitiv token i Figma, forplanter det seg automatisk gjennom alle semantiske tokens

---

## Primitive fargetokens

Definert i Figma-collection **TDC primaries** (Dark mode).

### Nøytrale

| Figma-navn | CSS-variabel | Hex |
|---|---|---|
| Color/Neutrals/White 1 | --color-white-1 | #FEFEFE |
| Color/Neutrals/White 2 | --color-white-2 | #F4F4F4 |
| Color/Neutrals/Black | --color-black | #0F0F0F |
| Color/Neutrals/Black 2 | --color-black-2 | #363636 |
| Color/Neutrals/Black 3 | --color-black-3 | #292929 |

### Fargeskalaer

| Figma-navn | CSS-variabel | Hex |
|---|---|---|
| **Grønn** | | |
| Color/Green/Green 1 | --color-green-1 | #9BF7A9 |
| Color/Green/Green 2 | --color-green-2 | #81EF92 |
| Color/Green/Green 3 | --color-green-3 | #67E47B |
| Color/Green/Green 4 | --color-green-4 | #142E18 |
| **Lilla** | | |
| Color/Purple/Purple 1 | --color-purple-1 | #BF9CF7 |
| Color/Purple/Purple 2 | --color-purple-2 | #7163E9 |
| Color/Purple/Purple 3 | --color-purple-3 | #5241D8 |
| Color/Purple/Purple 4 | --color-purple-4 | #20166A |
| **Rød** | | |
| Color/Red/Red | --color-red | #FF7E6C |
| Color/Red/Red 2 | --color-red-2 | #FE6650 |
| Color/Red/Red 3 | --color-red-3 | #F1422A |
| Color/Red/Red 4 | --color-red-4 | #901A09 |
| **Gul** | | |
| Color/Yellow/Yellow 1 | --color-yellow-1 | #FFE7A7 |
| Color/Yellow/Yellow 2 | --color-yellow-2 | #FFD12E |
| Color/Yellow/Yellow 3 | --color-yellow-3 | #FAA31C |
| Color/Yellow/Yellow 4 | --color-yellow-4 | #EB7821 |
| **Rosa** | | |
| Color/Pink/Pink | --color-pink | #F0889C |
| Color/Pink/Pink 2 | --color-pink-2 | #E9718A |
| Color/Pink/Pink 3 | --color-pink-3 | #DB5C76 |
| **Blå** | | |
| Color/Blue/Blue 1 | --color-blue-1 | #70A7F9 |
| Color/Blue/Blue 2 | --color-blue-2 | #5D8DD3 |
| Color/Blue/Blue 3 | --color-blue-3 | #4D79BB |

---

## Semantiske fargetokens

Definert i Figma-collection **TDC semantic** med modes: Dark (default) og Light.

Tokens er navngitt etter **rolle**, ikke visuell verdi.
`BG/Base` er alltid primær bakgrunn – uansett om den er mørk eller lys.

| Figma-navn | CSS-variabel | Dark | Light | Bruk |
|---|---|---|---|---|
| **Bakgrunn** | | | | |
| BG/Base | --color-bg-base | Color/Neutrals/Black | Color/Neutrals/White 1 | Primær sidebakgrunn |
| BG/Surface | --color-bg-surface | Color/Neutrals/Black 2 | Color/Neutrals/White 2 | Kort, panels, bokser |
| **Status – Suksess** | | | | |
| BG/Success | --color-bg-success | Color/Green/Green 1 | Color/Green/Green 3 | Bakgrunn |
| **Status – Advarsel** | | | | |
| BG/Warning | --color-bg-warning | Color/Yellow/Yellow 3 | Color/Yellow/Yellow 1 | Bakgrunn |
| **Status – Fare** | | | | |
| BG/Danger | --color-bg-danger | Color/Red/Red 3 | Color/Red/Red | Bakgrunn |
| **Forgrunn (tekst)** | | | | |
| FG/Base | --color-fg-base | Color/Neutrals/White 1 | Color/Neutrals/Black 3 | Primær tekst |
| FG/Brand | --color-fg-brand | Color/Green/Green 1 | Color/Green/Green 3 | Merkevare (1) |
| FG/Brand-2 | --color-fg-brand-2 | Color/Purple/Purple 1 | Color/Purple/Purple 3 | Merkevare (2) |
| FG/Brand-3 | --color-fg-brand-3 | Color/Yellow/Yellow 1 | Color/Yellow/Yellow 3 | Merkevare (3) |
| FG/Brand-4 | --color-fg-brand-4 | Color/Yellow/Yellow 3 | Color/Yellow/Yellow 2 | Merkevare (4) |
| FG/Accent | --color-fg-accent | Color/Yellow/Yellow 2 | Color/Yellow/Yellow 3 | Accent (1) |
| FG/Accent-2 | --color-fg-accent-2 | Color/Pink/Pink | Color/Pink/Pink 2 | Accent (2) |
| FG/Accent-3 | --color-fg-accent-3 | Color/Blue/Blue 1 | Color/Blue/Blue 2 | Accent (3) |
| FG/Allways dark | --color-fg-always-dark | Color/Neutrals/Black 3 | Color/Neutrals/Black 3 | Alltid mørk (ikke modal) |

---

## Typografi

Definert i Figma-collection **TDC primaries**.

### Primitive: Fonter

| Figma-navn | CSS-variabel | Verdi | Bruk |
|---|---|---|---|
| Typography/Primitive/FontFamily/sans | --font-family-sans | IBM Plex Sans | Body, labels, UI |
| Typography/Primitive/FontFamily/mono | --font-family-mono | Consolas, fallback IBM Plex Mono | Headings, display |

### Primitive: Font-vekter

| Figma-navn | Verdi |
|---|---|
| Typography/Primitive/FontWeight/sans-regular | Regular (400) |
| Typography/Primitive/FontWeight/sans-semibold | SemiBold (600) |
| Typography/Primitive/FontWeight/sans-bold | Bold (700) |
| Typography/Primitive/FontWeight/mono-regular | Regular (400) |
| Typography/Primitive/FontWeight/mono-bold | Bold (700) |

### Primitive: Fontstørrelser

| Figma-navn | CSS-variabel | Verdi |
|---|---|---|
| Typography/Primitive/FontSize/10 | --font-size-10 | 12px |
| Typography/Primitive/FontSize/20 | --font-size-20 | 14px |
| Typography/Primitive/FontSize/30 | --font-size-30 | 16px |
| Typography/Primitive/FontSize/40 | --font-size-40 | 18px |
| Typography/Primitive/FontSize/50 | --font-size-50 | 21px |
| Typography/Primitive/FontSize/60 | --font-size-60 | 24px |
| Typography/Primitive/FontSize/70 | --font-size-70 | 30px |
| Typography/Primitive/FontSize/80 | --font-size-80 | 40px |
| Typography/Primitive/FontSize/90 | --font-size-90 | 48px |
| Typography/Primitive/FontSize/100 | --font-size-100 | 64px |

### Primitive: Linjeavstand

| Figma-navn | CSS-variabel | Verdi |
|---|---|---|
| Typography/Primitive/LineHeight/none | --line-height-none | 1.0 |
| Typography/Primitive/LineHeight/tight | --line-height-tight | 1.2 |
| Typography/Primitive/LineHeight/snug | --line-height-snug | 1.35 |
| Typography/Primitive/LineHeight/normal | --line-height-normal | 1.5 |
| Typography/Primitive/LineHeight/relaxed | --line-height-relaxed | 1.75 |

### Primitive: Bokstavavstand

| Figma-navn | CSS-variabel | Verdi |
|---|---|---|
| Typography/Primitive/LetterSpacing/none | --letter-spacing-none | 0 |
| Typography/Primitive/LetterSpacing/wide | --letter-spacing-wide | 5% |
| Typography/Primitive/LetterSpacing/wider | --letter-spacing-wider | 10% |

### Semantiske: Overskrifter (Display, H1–H4)

Hver stil består av 6 komponenter: font-family, font-weight, font-size-desktop, font-size-mobile, line-height, letter-spacing.

**Font:** Consolas (primær), fallback IBM Plex Mono

| Stil | Desktop | Mobil | Vekt | Linjeavstand |
|---|---|---|---|---|
| **Heading/Display** | 64px | 48px | Regular | 1.2 |
| **Heading/H1** | 40px | 30px | Regular | 1.2 |
| **Heading/H2** | 30px | 30px | Regular | 1.35 |
| **Heading/H3** | 24px | 24px | Bold | 1.35 |
| **Heading/H4** | 21px | 21px | Bold | 1.5 |

**CSS:**
```css
h1, h2, h3, h4, .heading-display {
  font-family: Consolas, 'IBM Plex Mono', monospace;
}
```

### Semantiske: Body-tekst (Lead, Default, Caption, Label)

| Stil | Desktop | Mobil | Vekt | Linjeavstand |
|---|---|---|---|---|
| **Body/Lead** | 24px | 21px | Regular | 1.75 |
| **Body/Default** | 16px | 16px | Regular | 1.75 |
| **Body/Caption** | 14px | 14px | Regular | 1.5 |
| **Body/Label** | 16px | 16px | SemiBold | 1.0 |

### Semantiske: Mono/UI

| Stil | Desktop | Mobil | Vekt | Linjeavstand |
|---|---|---|---|---|
| **Mono/UI** | 16px | 14px | Regular | 1.5 |

---

## Spacing & Radius

Definert i Figma-collection **TDC Spacing & Radius**.

### Spacing

| Figma-navn | CSS-variabel | Verdi |
|---|---|---|
| Spacing/1 | --spacing-1 | 4px |
| Spacing/2 | --spacing-2 | 8px |
| Spacing/3 | --spacing-3 | 12px |
| Spacing/4 | --spacing-4 | 16px |
| Spacing/5 | --spacing-5 | 20px |
| Spacing/6 | --spacing-6 | 24px |
| Spacing/8 | --spacing-8 | 32px |
| Spacing/10 | --spacing-10 | 40px |
| Spacing/12 | --spacing-12 | 48px |
| Spacing/16 | --spacing-16 | 64px |
| Spacing/20 | --spacing-20 | 80px |
| Spacing/24 | --spacing-24 | 96px |

### Border Radius

| Figma-navn | CSS-variabel | Verdi |
|---|---|---|
| Radius/none | --radius-none | 0 |
| Radius/sm | --radius-sm | 4px |
| Radius/md | --radius-md | 8px |
| Radius/lg | --radius-lg | 12px |
| Radius/xl | --radius-xl | 16px |
| Radius/2xl | --radius-2xl | 24px |
| Radius/full | --radius-full | 9999px |

---

## Breakpoints

Definert i Figma-collection **TDC Breakpoints**.

Mobile-first approach (`min-width`).

| Figma-navn | CSS-variabel | Px | Enhet |
|---|---|---|---|
| Breakpoint/sm | --bp-sm | 480 | Små mobiler – legacy |
| Breakpoint/md | --bp-md | 768 | Nettbrett (iPad) – to-kolonne start |
| Breakpoint/lg | --bp-lg | 1024 | iPad landskap, små laptoper |
| Breakpoint/xl | --bp-xl | 1280 | Standard desktop |
| Breakpoint/2xl | --bp-2xl | 1440 | Bred desktop – Figma canvas |

### CSS-bruk

```css
/* Bruk alltid min-width for mobile-first */
@media (min-width: var(--bp-md)) { /* Mobil → Tablet */ }
@media (min-width: var(--bp-lg)) { /* Tablet → Desktop */ }
@media (min-width: var(--bp-xl)) { /* Desktop → Large */ }
```

**Regel:** Aldri `max-width` – bruk alltid `min-width` for mobile-first.

---

## Grid & Layout

Definert i Figma-collection **Layout** (variabler).

12-kolonners responsivt grid-system:
- **Mobil** (< 768px): 4 kolonner, 16px gutter/margin
- **Nettbrett** (768–1023px): 8 kolonner, 24px gutter/margin
- **Desktop** (≥ 1024px): 12 kolonner, 24px gutter/margin

Container maks-bredde: **1248px**

### Variabler

| Figma-navn | Type | Verdi | Bruk |
|---|---|---|---|
| `Grid/Columns/Mobile` | NUMBER | 4 | Antall kolonner på mobil |
| `Grid/Columns/Tablet` | NUMBER | 8 | Antall kolonner på nettbrett |
| `Grid/Columns/Desktop` | NUMBER | 12 | Antall kolonner på desktop |
| `Grid/Gutter/Mobile` | NUMBER | 16px | Avstand mellom kolonner (mobil) |
| `Grid/Gutter/Desktop` | NUMBER | 24px | Avstand mellom kolonner (desktop) |
| `Grid/Margin/Mobile` | NUMBER | 16px | Ytre margin (mobil) |
| `Grid/Margin/Desktop` | NUMBER | 32px | Ytre margin (desktop) |
| `Grid/Container/MaxWidth` | NUMBER | 1248px | Maksimal container-bredde |

### CSS-bruk

```css
/* Import i main.css */
@import "tokens.css";
@import "css/layout.css";

/* Utility-klasser */
.container {
  max-width: var(--grid-container-max-width);
  margin: 0 auto;
  padding: 0 var(--grid-margin-mobile);
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns-mobile), 1fr);
  gap: var(--gutter-mobile);
}

@media (min-width: var(--bp-md)) {
  .grid {
    grid-template-columns: repeat(var(--grid-columns-tablet), 1fr);
    gap: var(--gutter-desktop);
  }
}

@media (min-width: var(--bp-lg)) {
  .grid {
    grid-template-columns: repeat(var(--grid-columns-desktop), 1fr);
  }
}

/* Kolonne-span utilities */
.col-1 { grid-column: span 1; }
.col-2 { grid-column: span 2; }
/* ... osv. til .col-12 */
```

---

## Endringslogg

| Dato | Versjon | Endring |
|---|---|---|
| Mai 2025 | 1.0 | Opprettet |
| 27. mai 2026 | 5.0 | Semantiske tokens omdøpt til rollebaserte navn |
| 10. juni 2026 | 5.1 | Oppdatert primitive farger og breakpoints |
| 10. juni 2026 | 5.2 | Detaljert Grid & Layout + typografi |
| 10. juni 2026 | 6.0 | **Figma som primær kilde til sannhet.** Alle navn er nå Figma-paths. Fjernet trondheimdc.no-referanser. Lagt til komplette typografi-variabler. |
| 10. juni 2026 | 6.1 | **Grid-systemet aktivert.** Layout-variabler opprettet i Figma. 12-kolonners responsive grid med CSS custom properties. |
| 11. juni 2026 | 6.2 | **Typografi spesifisert.** Consolas for headings (H1–H4), fallback IBM Plex Mono. Grid Demo og responsive variant-komponenter opprettet. |
