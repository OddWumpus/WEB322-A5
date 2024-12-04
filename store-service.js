/*********************************************************************************
*  WEB322 – Assignment 04
*  I declare that this assignment is my own work in accordance with Seneca Academic Policy.  
*  No part of this assignment has been copied manually or electronically from any other source 
*  (including 3rd party web sites) or distributed to other students.
* 
*  Name: Roman Telets
*  Student ID: 162741227
*  Date: 2024/12/04
*  Vercel Web App URL: https://web-322-a5-lovat.vercel.app/
*  GitHub Repository URL: https://github.com/OddWumpus/WEB322-A5/
********************************************************************************/

// store-service.js
const Sequelize = require('sequelize');
const { Op } = Sequelize; // Import operators separately
const fs = require('fs').promises; // For asynchronous file reading
const path = require('path'); // Add this line to import path module

var sequelize = new Sequelize('neondb_testing', 'neondb_testing_owner', 'CU6Vhdar8qvx', {
    host: 'ep-weathered-paper-a5ir71bt.us-east-2.aws.neon.tech',
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
        ssl: { rejectUnauthorized: false }
    }
});

const Category = sequelize.define('Category', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    category: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    }
});

const readJsonFile = async (filePath) => {
    try {
        const fullPath = path.join(__dirname, filePath);
        await fs.access(fullPath, fs.constants.F_OK); 
        const data = await fs.readFile(fullPath, 'utf8');
        console.log(`Successfully read file: ${filePath}`);
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn(`File not found: ${filePath}. Skipping data load.`);
            return null;
        } else {
            console.error(`Error reading file ${filePath}:`, err);
            return null;
        }
    }
};

const compareArrays = (dbData, fileData) => {
    if (!fileData || !dbData) return false;
    const normalizeData = (data) => {
        return data.map(item => ({
            ...item,
            itemDate: item.itemDate ? new Date(item.itemDate).toISOString() : null
        }));
    };

    const normalizedDB = normalizeData(dbData);
    const normalizedFile = normalizeData(fileData);

    return JSON.stringify(normalizedDB.sort()) === JSON.stringify(normalizedFile.sort());
};


sequelize.authenticate()
    .then(() => console.log('Connection has been established successfully.'))
    .catch(error => console.error('Unable to connect to the database:', error));

const Item = sequelize.define('Item', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    body: Sequelize.TEXT,
    title: Sequelize.STRING,
    itemDate: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    featureImage: Sequelize.STRING,
    published: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    price: {
        type: Sequelize.DOUBLE,
        defaultValue: 0.0
    },
    category: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: Category,
            key: 'id'
        }
    }
});

Item.belongsTo(Category, { foreignKey: 'category' });

const fixCategorySequence = async () => {
    try {
        const result = await sequelize.query(
            `SELECT setval('"Categories_id_seq"', (SELECT MAX(id) FROM "Categories"));`,
            { type: Sequelize.QueryTypes.RAW }
        );
        console.log('Category sequence reset successfully');
    } catch (err) {
        console.error('Error resetting category sequence:', err);
    }
};

const fixItemSequence = async () => {
    try {
        const result = await sequelize.query(
            `SELECT setval('"Items_id_seq"', (SELECT MAX(id) FROM "Items"));`,
            { type: Sequelize.QueryTypes.RAW }
        );
        console.log('Item sequence reset successfully');
    } catch (err) {
        console.error('Error resetting item sequence:', err);
    }
};

module.exports = {
    initialize: async () => {
        try {
            await sequelize.sync();
            console.log("Database synced");
    
            // Fix sequences
            await fixCategorySequence();
            await fixItemSequence();  // Add this function similar to category sequence
    
            const itemsData = await readJsonFile('./data/items.json');
            if (itemsData) {
                const existingItems = await Item.count();
                if (existingItems === 0) {
                    try {
                        // Ensure each item has required fields
                        const processedItems = itemsData.map(item => ({
                            ...item,
                            itemDate: item.itemDate || new Date(),
                            published: item.published === 'on' || item.published === true,
                            price: parseFloat(item.price) || 0.0
                        }));
                        
                        await Item.bulkCreate(processedItems);
                        console.log("Items inserted successfully");
                    } catch (err) {
                        console.error("Error inserting items:", err);
                    }
                } else {
                    console.log("Items table not empty. Skipping initial data load.");
                }
            }
    
            return Promise.resolve();
        } catch (err) {
            console.error("Unable to sync database:", err);
            return Promise.reject("unable to sync the database");
        }
    },

    // Update getAllItems to handle missing file more gracefully
    getAllItems: () => { // Optimized getAllItems
        return Item.findAll({
            include: [{
                model: Category,
                attributes: ['id', 'category']
            }]
        }); // No need for Promise wrapper, Sequelize returns a Promise
    },
    
    getItemsByCategory: (category) => { // Optimized getItemsByCategory
        return Item.findAll({
            where: { category: category },
            include: [{
                model: Category,
                attributes: ['id', 'category']
            }]
        }); // No need for Promise wrapper
    },

    getItemsByMinDate: (minDateStr) => {
        return new Promise((resolve, reject) => {

            Item.findAll({
                where: {
                    itemDate: {
                        [Op.gte]: new Date(minDateStr)
                    }
                }
            })
                .then(data => resolve(data))
                .catch(() => reject("no results returned"));
        });
    },
    getItemById: (id) => {
        return new Promise((resolve, reject) => {
            Item.findAll({ where: { id: id } })
                .then(data => data.length > 0 ? resolve(data[0]) : reject()) // reject if no data
                .catch(() => reject("no results returned"));

        });
    },

    addItem: async (itemData) => {
        try {
            const cleanedData = {
                ...itemData,
                published: itemData.published === 'on' || itemData.published === true,
                price: parseFloat(itemData.price) || 0.0,
                itemDate: itemData.itemDate || new Date(),
                category: parseInt(itemData.category) || null // Convert and save category ID
            };

            Object.keys(cleanedData).forEach(key => {
                if (cleanedData[key] === "") {
                    cleanedData[key] = null;
                }
            });

            const newItem = await Item.create(cleanedData);
            return newItem;
        } catch (err) {
            console.error('Error in addItem:', err);
            throw new Error(err.message || 'Unable to create item');
        }
    },

    getPublishedItems: () => {
        return new Promise((resolve, reject) => {
            Item.findAll({ where: { published: true } })
                .then(data => resolve(data))
                .catch(() => reject("no results returned"));
        });

    },

    getPublishedItemsByCategory: (categoryId) => {
        return new Promise((resolve, reject) => {
            Item.findAll({ where: { published: true, category: categoryId } })
                .then(data => resolve(data))
                .catch(() => reject("no results returned"));

        });

    },

    getCategories: () => {

        return new Promise((resolve, reject) => {
            Category.findAll().then(data => {
                resolve(data);
            }).catch(() => reject("no results returned"));

        });

    },

    addCategory: async (categoryData) => {
        try {
            // Input validation
            if (!categoryData || typeof categoryData !== 'object') {
                throw new Error('Invalid category data provided');
            }

            // Clean the data
            const cleanedData = {};
            for (const prop in categoryData) {
                cleanedData[prop] = categoryData[prop] === "" ? null : categoryData[prop];
            }

            // Ensure category field exists
            if (!cleanedData.category) {
                throw new Error('Category name is required');
            }

            // Check if category already exists
            const existingCategory = await Category.findOne({
                where: { category: cleanedData.category }
            });

            if (existingCategory) {
                throw new Error('Category already exists');
            }

            // Create the new category without specifying the id
            const newCategory = await Category.create({
                category: cleanedData.category
            });
            
            return newCategory;

        } catch (err) {
            console.error('Error in addCategory:', err);
            throw new Error(err.message || 'Unable to create category');
        }
    },

    deleteCategoryById: (id) => {
        return new Promise((resolve, reject) => {
            Category.destroy({ where: { id: id } })
                .then(rowsAffected => {
                    if (rowsAffected > 0) {
                        resolve();
                    } else {
                        reject("Category not found");
                    }
                })
                .catch(err => reject(err));
        });
    },

    deleteItemById: (id) => {
        return new Promise((resolve, reject) => {
            Item.destroy({ where: { id: id } })
                .then(rowsAffected => {
                    if (rowsAffected > 0) {
                        resolve();
                    } else {
                        reject("Item not found");
                    }
                })
                .catch(err => reject(err));
        });
    }
};