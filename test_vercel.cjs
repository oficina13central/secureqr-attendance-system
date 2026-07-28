const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => {
            console.log('BROWSER_LOG:', msg.text());
        });
        
        page.on('pageerror', error => {
            console.log('PAGE_ERROR:', error.message);
        });

        const response = await page.goto('https://secureqr-attendance-system.vercel.app', { waitUntil: 'networkidle0' });
        console.log('STATUS:', response.status());
        
        const rootHtml = await page.evaluate(() => {
            return document.getElementById('root') ? document.getElementById('root').innerHTML : 'NO_ROOT';
        });

        console.log('ROOT_HTML_LENGTH:', rootHtml.length);
        if (rootHtml.length < 100) {
            console.log('ROOT_HTML_CONTENT:', rootHtml);
        }
        
        await browser.close();
    } catch (e) {
        console.error('ERROR:', e);
    }
})();
