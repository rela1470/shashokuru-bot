'use strict'

const Nightmare  = require('nightmare');
const vo         = require('vo');
const moment     = require('moment');
const request    = require('request');

const URL_BASE = 'https://shashokuru.jp'

function login(nightmare)
{
    console.log("** login **\nmail:" + process.env.NODE_EMAIL);
    return nightmare
        .goto(URL_BASE + '/login')
        .insert('input[name=email]',  process.env.NODE_EMAIL)
        .insert('input[name=password]', process.env.NODE_PASSWORD)
        .click('button.single-click')
        .wait('p.store');//弁当が1個出てくるまで
}

function getItem(nightmare)
{
    console.log('');
    console.log('** getItem **');

    return nightmare
        .goto(URL_BASE)
        .wait('p.store')//弁当が1個出てくるまで
        .evaluate(function() {
            var returnArray = [];

            var itemArray = document.querySelectorAll('div.wrapper');

            for (var item of itemArray) {
                var data = {};
                data.image = item.querySelector('img').src;
                data.price = item.querySelector('p.price').innerHTML.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g,'');
                data.name = item.querySelector('p.title').innerHTML;
                data.url = item.querySelector('a').href;
                returnArray.push(data);
            }

            return returnArray;
        });
}

function sleep(ms) {
    return function (cb) {
        setTimeout(cb, ms);
    };
}

function postSlack(message, item)
{
    if (item) {
        var attachments = {
            attachments: [{
                image_url: item.image,
                title_link: item.url,
                title: item.price + ' ' + item.name,
                fallback: item.price + ' ' + item.name,
            }]
        }
    }
    else {
        var attachments = {
            attachments: [{
                text: message
            }]
        }
    }

    var options = {
        uri: process.env.NODE_SLACK_URL,
        headers: { 'Content-Type': 'application/json' },
        json: attachments
    };

    request.post(options, function(error, response, body){
        if (!error && response.statusCode == 200) {
            console.log(body);
        } else {
            console.log('error: '+ response.statusCode + '\n' + response.body);
        }
    });
}

//メインのフロー
vo(function* () {

    try {
        console.log('*** shashokuru-bot ***');
        let nightmare = Nightmare({
            show: true,
            waitTimeout: 100000, // in ms
            gotoTimeout: 100000, // in ms
            loadTimeout: 100000, // in ms
            executionTimeout: 100000, // in ms
        });


        yield login(nightmare);

        var itemArray = yield getItem(nightmare);

        console.dir(itemArray);

        postSlack(moment().format('YYYY年MM月DD日') + '本日のお弁当\n', null);
        yield sleep(1000);

        for (var item of itemArray) {
            postSlack('', item);
        }

        yield sleep(1000);

        yield nightmare.end();

        return;

    } catch(error) {
        console.log(error);
        console.log('end');
        process.exit();
    }

})((err, result) => {
    if (err) return console.log(err);
console.log('end');
process.exit(0);
});