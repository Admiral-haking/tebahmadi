/**
 * A tiny, inline-safe stylesheet for the storefront chrome.
 *
 * The full MUI/Emotion styles remain the source of truth. These rules only
 * prevent a flash of unstyled desktop and mobile headers while streamed MUI
 * styles are being parsed on slow mobile connections.
 */
export const criticalLayoutCss = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; min-width: 0; overflow-x: hidden; }

  .teb-desktop-header { display: none; }
  .teb-mobile-header {
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    z-index: 1100;
    width: 100%;
    min-width: 0;
    background: rgba(255, 255, 255, .97);
    border-bottom: 1px solid #dee0d0;
  }
  .teb-mobile-header__row {
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 8px;
    padding: 8px;
    direction: rtl;
  }
  .teb-mobile-header__menu {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
  }
  .teb-mobile-header__menu button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 4px;
    border: 0;
    background: transparent;
    color: #285d47;
  }
  .teb-mobile-header__search {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    max-width: none;
  }
  .teb-mobile-header__search form { width: 100%; min-width: 0; margin: 0; }
  .teb-mobile-header__search form > div {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 6px;
    padding: 4px 8px;
    overflow: hidden;
    border-radius: 12px;
    background: #f7f6f3;
  }
  .teb-mobile-header__search input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font: inherit;
    text-align: right;
  }
  .teb-mobile-header__logo {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 0 auto;
    min-width: 40px;
  }
  .teb-mobile-header__info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 6px 8px;
    overflow: hidden;
    border-top: 1px solid #dee0d0;
    color: #285d47;
  }
  .teb-mobile-header__info p {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: 12px;
  }

  .teb-announcement {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 38px;
    overflow: hidden;
    background: #171b12;
    color: #fff;
  }
  .teb-announcement__container { width: 100%; min-width: 0; margin: 0 auto; padding: 0 12px; }
  .teb-announcement__inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    gap: 8px;
    padding: 6px 0;
  }
  .teb-announcement__text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: 11px;
    line-height: 1.6;
  }
  .teb-announcement__link {
    flex: 0 0 auto;
    padding: 3px 10px;
    border: 1px solid rgba(255, 255, 255, .35);
    border-radius: 999px;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .teb-app-shell { min-height: 100vh; min-width: 0; overflow-x: hidden; }
  .teb-app-main { min-width: 0; padding-bottom: calc(84px + env(safe-area-inset-bottom)); }
  .teb-mobile-bottom-nav {
    display: block;
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1200;
    background: rgba(255, 255, 255, .96);
    border-top: 1px solid #dee0d0;
    padding-bottom: env(safe-area-inset-bottom);
  }

  @media (min-width: 900px) {
    .teb-desktop-header { display: block; }
    .teb-mobile-header, .teb-mobile-bottom-nav { display: none; }
    .teb-app-main { padding-bottom: 32px; }
  }
`;
