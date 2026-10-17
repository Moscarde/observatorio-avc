// Imagens em domínio público/CC0, servidas localmente com autoria registrada.
const base = import.meta.env.BASE_URL + "images/";
export const images = {
  hero: {
    src: base + "rio-botafogo-entardecer.webp",
    small: base + "rio-botafogo-entardecer-1200.webp",
    alt: "Enseada de Botafogo e a cidade do Rio de Janeiro ao entardecer, vistas do alto.",
    credit: "Wilfredor",
    license: "CC0",
    page: "https://commons.wikimedia.org/wiki/File:Rio_de_Janeiro_coastal_skyline_at_sunset,_Brazil.jpg",
  },
  method: {
    src: base + "rio-montanhas-entardecer.webp",
    small: base + "rio-montanhas-entardecer-1200.webp",
    alt: "Vista aérea do Rio de Janeiro com as montanhas ao entardecer.",
    credit: "Wilfredor",
    license: "CC0",
    page: "https://commons.wikimedia.org/wiki/File:Aerial_view_of_Rio_de_Janeiro_and_its_mountains,_Brazil.jpg",
  },
  arteries: {
    src: base + "gray516-arterias-encefalo.webp",
    alt: "Gravura anatômica da base do encéfalo com as artérias cerebrais destacadas em vermelho.",
    credit: "Henry Vandyke Carter, Gray's Anatomy (1918)",
    license: "Domínio público",
    page: "https://commons.wikimedia.org/wiki/File:Gray516.png",
  },
} as const;
