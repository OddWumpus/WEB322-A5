/*********************************************************************************
*  WEB322 – Assignment 05
*  I declare that this assignment is my own work in accordance with Seneca Academic Policy.  
*  No part of this assignment has been copied manually or electronically from any other source 
*  (including 3rd party web sites) or distributed to other students.
* 
*  Name: Roman Telets
*  Student ID: 162741227
*  Date: 2024/12/04
*  Vercel Web App URL: https://web-322-a05-lovat.vercel.app/
*  GitHub Repository URL: https://github.com/OddWumpus/WEB322-A5/
********************************************************************************/

// server.js
const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const multer = require('multer');
const stripJs = require('strip-js');
const storeService = require('./store-service.js');
const fs = require('fs');
const handlebars = require('express-handlebars');

// App Configuration
const app = express();
const PORT = process.env.PORT || 8081;

// Set up multer for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads/'); // Set the destination folder for uploaded images
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, uniqueSuffix + '-' + file.originalname); // set a unique file name to prevent collisions
    }
  });
const upload = multer({ storage: storage });

// Handlebars Configuration
const configureHandlebars = () => {
    const hbs = handlebars.create({
        extname: '.hbs',
        helpers: {
            navLink: (url, options) => (
                `<li class="nav-item">
                    <a class="nav-link${url == app.locals.activeRoute ? " active" : ""}" href="${url}">
                        ${options.fn(this)}
                    </a>
                </li>`
            ),
            equal: (lvalue, rvalue, options) => {
                if (arguments.length < 3) {
                    throw new Error("Handlebars Helper 'equal' needs 2 parameters");
                }
                return lvalue === rvalue ? options.fn(this) : options.inverse(this);
            },
            safeHTML: (context) => stripJs(context),
            formatDate: function(dateObj) {
                if (!dateObj) return "";
                let date;
                try {
                    date = new Date(dateObj);
                    if (isNaN(date.getTime())) return "";
                    let year = date.getFullYear();
                    let month = (date.getMonth() + 1).toString().padStart(2, '0');
                    let day = date.getDate().toString().padStart(2, '0');
                    return `${year}-${month}-${day}`;
                } catch (err) {
                    return "";
                }
            }
        },
        runtimeOptions: {
            allowProtoPropertiesByDefault: true,
            allowProtoMethodsByDefault: true
        }
    });

    app.engine('.hbs', hbs.engine);
    app.set('view engine', '.hbs');
};

// Middleware Setup
const setupMiddleware = () => {
    app.use(express.static('public'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(setActiveRoute);
};

// Route Handler Middleware
const setActiveRoute = (req, res, next) => {
    const route = req.path.substring(1);
    app.locals.activeRoute = '/' + (
        isNaN(route.split('/')[1])
            ? route.replace(/\/(?!.*)/, '')
            : route.replace(/\/(.*)/, '')
    );
    app.locals.viewingCategory = req.query.category;
    next();
};

// Image Upload Handler
const handleImageUpload = async (file) => {
    if (!file) return '';

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) resolve(result.url);
            else reject(error);
        });
        streamifier.createReadStream(file.buffer).pipe(stream);
    });
};

// Route Handlers

const routeHandlers = {
    about: (req, res) => res.render('about'),

    shop: async (req, res) => {
        try {
            let queryPromise;
            if (req.query.category) {
                queryPromise = storeService.getPublishedItemsByCategory(req.query.category);
            } else {
                queryPromise = storeService.getPublishedItems();
            }

            const items = await queryPromise
            const categories = await storeService.getCategories();
            res.render('shop', { items, categories });

        } catch (error) {

            res.render('shop', { message: "no results" });
        }

    },

    categories: async (req, res) => {

        try {

            const categories = await storeService.getCategories();
            res.render("categories", { categories });

        } catch (error) {
            res.render("categories", { message: "no results" });
        }
    },

    items: async (req, res) => {
        try {
            let items = [];
            const categories = await storeService.getCategories();
    
            if (req.query.category) {
                console.log("Filtering by category:", req.query.category);
                items = await storeService.getItemsByCategory(parseInt(req.query.category));
            } else if (req.query.minDate) {
                console.log("Filtering by minDate:", req.query.minDate);
                items = await storeService.getItemsByMinDate(req.query.minDate);
            } else {
                console.log("Fetching all items");
                items = await storeService.getAllItems();
            }
    
            res.render("items", {
                items: items,
                categories: categories
            });
        } catch (error) {
            console.error("Error fetching items:", error); // Log errors
            res.render("items", { message: "no results", categories: [] });
        }
    },

    addItem: async (req, res) => {
        try {
            let imagePath = null;
            if (req.file) {
                imagePath = `/uploads/${req.file.filename}`;
            }
            const itemData = {
                ...req.body,
                featureImage: imagePath,
                itemDate: new Date()
            };
            await storeService.addItem(itemData);
            res.redirect('/items');
        } catch (error) {
            console.error('Error adding item:', error);
            res.status(500).send('Unable to add item.');
        }
    },

    "addItemForm": async (req, res) => {
        try {
            const categories = await storeService.getCategories();
            res.render("addItem", { categories });
        } catch (error) {
            res.render("addItem", { categories: [] }); // pass empty array if error
        }
    },

    addItem: async (req, res) => {
        try {
            req.body.featureImage = req.file ? `/uploads/${req.file.filename}` : null;
            await storeService.addItem(req.body);
            res.redirect('/items');
        } catch (error) {
            console.log(error);
            res.status(500).send('Unable to add item.');
        }
    },

    getItemById: async (req, res) => {
        try {
            const item = await storeService.getItemById(req.params.id);
            res.json(item);
        } catch (error) {
            res.status(404).json({ message: 'Item not found' });
        }
    },
    "addCategory": (req, res) => {
        res.render("addCategory");
    },
    "processCategory": (req, res) => {
        storeService.addCategory(req.body)
            .then(() => { res.redirect("/categories"); })
            .catch(err => res.status(500).send("Unable to create the new category."));
    },
    "deleteCategoryById": (req, res) => {
        storeService.deleteCategoryById(req.params.id)
            .then(() => res.redirect("/categories"))
            .catch(() => res.status(500).send("Unable to Remove Category / Category not found)"));
    },

    deleteItemById: (req, res) => {
        storeService.deleteItemById(req.params.id)
            .then(() => { res.redirect("/items"); })
            .catch(err => res.status(500).send("Unable to Remove Item / Item not found)"));
    }



};

// Route Setup
const setupRoutes = () => {
    app.get('/about', routeHandlers.about);
    app.get('/shop', routeHandlers.shop);
    app.get('/categories', routeHandlers.categories);
    app.get('/items', routeHandlers.items);
    app.get('/items/add', routeHandlers.addItemForm);

    app.post('/items/add', multer().single('featureImage'), routeHandlers.addItem);
    app.get('/shop/:id', routeHandlers.getItemById);

    app.get('/categories/add', routeHandlers.addCategory);
    app.post('/categories/add', routeHandlers.processCategory);
    app.get('/categories/delete/:id', routeHandlers.deleteCategoryById);

    app.post('/items/add', upload.single('featureImage'), routeHandlers.addItem);
    app.get('/items/delete/:id', routeHandlers.deleteItemById);

    // 404 Handler
    app.use((req, res) => {
        res.status(404).render('404', {
            message: 'The page you are looking for does not exist.'
        });
    });
};

// Server Initialization
const initializeServer = async () => {
    try {
        await storeService.initialize();
        console.log('Server initialized');

        configureHandlebars();
        setupMiddleware();
        setupRoutes();

        app.listen(PORT, () => {
            console.log(`Express http server listening on port http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Server initialization failed:', error);
        process.exit(1);
    }
};

initializeServer();

module.exports = app;