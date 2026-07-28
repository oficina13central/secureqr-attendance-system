const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(3030, async () => {
    console.log('Server started on port 3030');
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER_ERROR:', msg.text());
            } else {
                console.log('BROWSER_LOG:', msg.text());
            }
        });
        
        page.on('pageerror', error => {
            console.log('PAGE_ERROR:', error.message);
        });

        page.on('requestfailed', request => {
            console.log('REQUEST_FAILED:', request.url(), request.failure().errorText);
        });

        await page.goto('http://localhost:3030', { waitUntil: 'networkidle0' });
        
        console.log('Page loaded successfully. Check errors above.');
        await browser.close();
    } catch (e) {
        console.error('PUPPETEER_ERROR:', e);
    } finally {
        server.close();
        process.exit(0);
    }
});
