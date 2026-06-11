// Data-driven partner list for the partner wall (rendered near the footer).
// `logo` is a filename inside assets/images/partners/2025/.
// `url` is attached only where it was verified from the previous production
// site (old/_includes/content/partners.html). Partners introduced for 2025
// without a verified link use `url: null` and render as a non-linked logo —
// fill these in from the signed partner agreements when available.
// The wall is shuffled client-side on load (see assets/js/main.js).
export default [
  { name: "Autronica", logo: "autronica.svg", url: null },
  { name: "Brilliant", logo: "brilliant.webp", url: null },
  { name: "Capgemini", logo: "capgemini.svg", url: "https://capgemini.no" },
  {
    name: "Computas",
    logo: "Computas_logo_liggende_hvit.png",
    url: "https://computas.no",
  },
  { name: "Crayon", logo: "crayon.svg", url: "https://crayonconsulting.no/" },
  {
    name: "Den Norske Dataforening",
    logo: "dataforeningen-white.svg",
    url: null,
  },
  {
    name: "Norges Domstoler",
    logo: "domstoladministrasjonen.svg",
    url: "https://www.domstol.no/",
  },
  { name: "EL og IT Forbundet", logo: "ELogIT.png", url: "https://elogit.no" },
  { name: "Equinor", logo: "equinor.svg", url: null },
  { name: "Funktive", logo: "funktive.svg", url: null },
  { name: "Hemit", logo: "hemit.svg", url: null },
  { name: "Itema", logo: "itema.svg", url: "https://itema.no" },
  { name: "Iver", logo: "iver.svg", url: null },
  { name: "Kantega", logo: "kantega.svg", url: "https://www.kantega.no/" },
  { name: "Lilleng Driv", logo: "lilleng-driv.png", url: null },
  { name: "NAV", logo: "nav.svg", url: "https://www.nav.no/" },
  {
    name: "Netcompany",
    logo: "netcompany-logotype-white-RGB.png",
    url: null,
  },
  {
    name: "Norconsult Digital",
    logo: "norconsult-digital-svg-white.svg",
    url: "https://norconsultdigital.no/",
  },
  { name: "Norsk Helsenett", logo: "norsk-helsenett.svg", url: null },
  { name: "Signicat", logo: "signicat.png", url: "https://www.signicat.com/" },
  {
    name: "Skatteetaten",
    logo: "skatteetaten.svg",
    url: "https://www.skatteetaten.no/",
  },
  {
    name: "Sopra Steria",
    logo: "sopra-steria.svg",
    url: "https://www.soprasteria.no/",
  },
  { name: "SpareBank 1 Utvikling", logo: "sparebank1dev.svg", url: null },
  { name: "Sportradar", logo: "sportradar.svg", url: null },
  {
    name: "Statens vegvesen",
    logo: "statens-vegvesen.svg",
    url: "https://www.vegvesen.no/",
  },
  { name: "Sticos", logo: "sticos.svg", url: "https://www.sticos.no/" },
  { name: "Twoday", logo: "twoday.svg", url: null },
  { name: "Webstep", logo: "webstep.svg", url: "https://webstep.no" },
  { name: "XLENT", logo: "XLENT-LOGO-PNG-VIT.png", url: null },
];
