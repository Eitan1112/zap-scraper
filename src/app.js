const request = require('request-promise')
const HTMLParse = require('node-html-parser');
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
require('dotenv').config()

const Get_Categories_From_Navbar = () => {
    // Returns list ofcategory pages from navbar of ZAP
    return require('./categories')
}

const Test_Product = (product) => {
    // Gets product HTML
    // Returns true or false wether the product costs 1 shekel or not
    if (!product.description.includes('רק הראשון זוכה') && !product.description.includes('1 ש"ח!') && !product.description.includes('למימוש ההטבה')) {
        return false
    }
    const json_log = fs.readFileSync('log.json', 'utf8', (err) => { }) 
    if (json_log.includes(product.title)){
        return false
    }
    return true
}


const Test_Page = (page) => {
    // Gets page HTML
    // Returns true or false wether in the page there is a product costs 1 shekel or not
    if (page.includes('רק הראשון זוכה')
        || page.includes('1 ש"ח!')
        || page.includes('למימוש ההטבה')
    ) {
        return true
    }
    return false
}

const Get_Inner_HTML = (str) => {
    // Gets an HTML Element
    // Return the inner HTML (according to pattern)
    return String(str)
        .replace('<div class="title">', '')
        .replace('<div class="desc">\r\n', '')
        .replace('</div>', '')
        .trim()
}

const Get_URL = (body) => {
    // Gets the div of a specific deal
    // Returns the link it leads to
    const start = '<a href="'
    const end = '" target="_blank" rel="nofollow">'
    const starting_index = body.indexOf(start)
    const ending_index = body.indexOf(end)
    const extracted_link = (body.slice(starting_index + start.length, ending_index))
    return `www.zap.co.il/${extracted_link}`
}

const Scrape_Page = (body, url ,category) => {
    // Gets body of page
    // Creates an object for each product
    // Calls Test_Product for every product object
    // Returns list of products with products who cost 1 shekel in page or False if the page does not return results
    const parsed_body = HTMLParse.parse(body)
    const deals = parsed_body.querySelectorAll('.deal')
    let list = []
    deals.forEach((element) => {
        let title = Get_Inner_HTML(element.querySelectorAll('.title'))
        let description = Get_Inner_HTML(element.querySelectorAll('.desc'))
        const link = Get_URL(String(element))
        let product = { title, description, url, link }
        if (Test_Product(product)) {
            Alert_Me(category, product)
            list.push(product)
        }
    })
    if (list.length === 0) {
        return false
    }
    return list

}

const Send_Mail = (product) => {
    sgMail.setApiKey(process.env.sgMail)
    const message = `
    <div style="direction: rtl;">
    <h1 style="text-align: center;"><strong>מוצר חדש בזאפ!</strong></h1>
    <p style="text-align: right;"><strong>כותרת המוצר: ${product.title}</strong></p>
    <p style="text-align: right;"><strong>תיאור המוצר: ${product.description}</strong></p>
    <p style="text-align: right;"><strong>לינק לעמוד בזאפ: ${product.url}</strong></p>
    <p style="text-align: right;"><strong>לינק למוצר בחנות: ${product.link}</strong></p>
    <p style="text-align: right;">&nbsp;</p>
    <p style="text-align: right;"><strong><img src="https://html-online.com/editor/tinymce4_6_5/plugins/emoticons/img/smiley-cool.gif" alt="cool" /></strong></p>
    </div>`
    sgMail.send({
        to: 'Eitan1112@gmail.com',
        from: 'Eitan1112@gmail.com',
        subject: 'Found new product on ZAP',
        html: message
    })
}

const Phone_Call = () => {
    const accountSID = process.env.accountSID
    const authToken = process.env.authToken

    const client = require('twilio')(accountSID, authToken);
    console.log('Trying to call...')
    client.calls
        .create({
            url: 'http://demo.twilio.com/docs/voice.xml',
            to: '+972526977090',
            from: '+19518015178'
        })
        .then(call => console.log(`Calling`))
        .catch(err => console.log(`Couldn't complete call. Error: ${err.message}`));    
}

const Alert_Me = async (category, products) => {
    // Gets a product list or string and category
    // Put them in the log file
    // Sends me a mail and calls
    const products_json = await JSON.stringify(products)
    console.log(`Products Were Found!!!
    Category: ${category}
    Products: ${products}`)
    try {
        fs.appendFile('log.json', products_json, (err) => { if (err) { console.log('Couldnt write to file.') } })
        Send_Mail(JSON.stringify(products))
        Phone_Call()
    } catch(err) {
        console.log(`Couldn't save to json, send mail or create a phone call. 
        Error: ${err.message}`)
    }
    
}


let products = []
const Scrape_Category_Pages = (category, index = 1) => {
    // Gets category
    // Calls Scrape_Page on all pages, stops on last page
    // Returns a list of all products with products who cost 1 shekel in category
    //let url = 'https://www.example.com'
    let url = `https://zap.co.il/${category}?pageinfo=${index}`
    console.log(`Fetching from: ${url}`)
    request(url, { timeout: 4000 })
        .then((body) => {
            if (!body.includes('לא נמצאו תוצאות')) {
                if (Test_Page(body)) {
                    console.log(`Positive in page: ${url}`)
                    const scrape_programs = Scrape_Page(body, url, category)
                    if (scrape_programs) {
                        products.push(scrape_programs)
                    }
                } else {
                    console.log(products)
                }
                Scrape_Category_Pages(category, index + 1)
            } else {
                categories = Get_Categories_From_Navbar()
                category_i = categories.indexOf(category) + 1
                if (category_i !== categories.length) { // Switching to different category
                    products = []
                    Scrape_Category_Pages(categories[category_i])
                } else { // Finished all categories
                    console.log('Starting main...')
                    main()
                }
            }
        })
        .catch((err) => {
            console.log(`Couldnt proceed with request to ${url}`)
            Scrape_Category_Pages(category, index + 1)
        })
}


const main = () => {
    categories = Get_Categories_From_Navbar()
    Scrape_Category_Pages(categories[0])
}


console.log('Starting main...')
main()
