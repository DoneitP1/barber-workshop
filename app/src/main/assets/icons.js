const iconPaths = {
  search: '<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.1 16.1 4.4 4.4"/>',
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  products: '<path d="M3 8h18v12H3zM2 4h20v4H2zM9 12h6"/>',
  orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3"/>',
  ads: '<path d="m3 10 17-6v16L3 14zM6 15l2 6h4l-2-5M20 8l2-1M20 16l2 1"/>',
  account: '<path d="M3 10h18l-2-6H5zM4 10v10h16V10M9 20v-6h6v6M2 10c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  chart: '<path d="M4 19V9M10 19V4M16 19v-7M22 19H2"/>',
  warning: '<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 9h1M18 15h1"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.2 8.2 12.3 12.3M8.2 15.8 20.5 3.5"/>',
  sparkle: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>'
};
function icon(name, extraClass = '') {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name] || iconPaths.products}</svg>`;
}
