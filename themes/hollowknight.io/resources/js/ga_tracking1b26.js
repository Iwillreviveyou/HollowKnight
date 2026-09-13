
// Ensure dataLayer and gtag exist before GA4 script loads.
// GA4 will automatically flush this queue once it initializes.
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };

function sendEventToGA(eventName, params) {
    gtag('event', eventName, params || {});
}

(function () {
    'use strict';
    if (typeof window === 'undefined') return;

    var path = location.pathname || '/';
    var isHome = (path === '/' || path === '');

    function pageType() {
        if (isHome) return 'home';
        if (/\.games$/.test(path)) return 'category';
        if (/^\/tag\//.test(path)) return 'tag';
        if (/^\/search/.test(path)) return 'search';
        return 'game';
    }

    var startTs = Date.now();
    function secondsOnPage() {
        return Math.round((Date.now() - startTs) / 1000);
    }

    // Base params attached to every event
    function base(extra) {
        var p = {
            page_path: isHome ? '/' : path,
            page_location: location.href,
            page_type: pageType(),
            is_home: isHome ? 1 : 0
        };
        if (extra) {
            for (var k in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k];
            }
        }
        return p;
    }

    // ---- 1) Users who land on the url ----
    sendEventToGA('page_enter', base());

    // ---- state ----
    var playClicked = false;
    var exitSent = false; // only one of navigate_away / tab_close per page

    // ---- 2) Users who click the Play button ----
    function markPlay(source) {
        if (playClicked) return; // count once per page
        playClicked = true;
        sendEventToGA('play_click', base({ play_source: source || 'unknown' }));
    }
    window.gaMarkPlay = markPlay; // let other inline scripts call it if needed

    // Play button that lives on this page itself (new-window mode)
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#show-embed, .play-btn__ctrl, [data-ga-play]')) {
            markPlay('button');
        }
    }, true);

    // Play button inside the (same-origin) embed iframe -> embed posts up here
    window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (d && (d.type === 'ga_play_click' || d.type === 'play_clicked')) markPlay('embed');
    });

    // ---- Page-leave event dispatcher ----
    function sendExit(type, extra) {
        if (exitSent) return;
        exitSent = true;
        var params = base({
            engaged_play: playClicked ? 1 : 0,
            time_on_page: secondsOnPage(),
            // beacon: make sure it still sends while the page is closing/navigating
            transport_type: 'beacon'
        });
        if (extra) {
            for (var k in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, k)) params[k] = extra[k];
            }
        }
        sendEventToGA(type, params);
    }

    // ---- 4) Users who move to another url ----
    // Fire the moment a navigating link is clicked (page still alive -> reliable send).
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href)) return;
        // target=_blank opens a new tab -> the current tab does NOT leave
        if (a.target && a.target.toLowerCase() === '_blank') return;
        var internal = (a.host === location.host);
        sendExit('navigate_away', {
            destination: a.href,
            link_type: internal ? 'internal' : 'external'
        });
    }, true);

    // ---- 3) Users who close the tab/browser ----
    // pagehide fires on close tab / close browser / reload / typing a new URL.
    // If no navigate_away happened (no link clicked) -> treat it as a tab close.
    window.addEventListener('pagehide', function () {
        sendExit('tab_close', {});
    });
})();