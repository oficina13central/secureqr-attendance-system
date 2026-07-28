const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(3031, async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => {
            console.log('BROWSER_LOG:', msg.text());
        });
        
        await page.goto('http://localhost:3031', { waitUntil: 'networkidle0' });
        
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
    } finally {
        server.close();
        process.exit(0);
    }
});
