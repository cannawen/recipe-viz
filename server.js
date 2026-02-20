const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { generateMermaidFlowchart } = require('./recipeParser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Recipe extraction endpoint
app.post('/api/convert', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Fetch the recipe page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();
        const recipe = extractRecipe(html, url);

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            throw new Error('Could not extract recipe data from the URL');
        }

        // Generate Mermaid flowchart
        const mermaid = generateMermaidFlowchart(recipe);

        res.json({
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            mermaid: mermaid
        });

    } catch (error) {
        console.error('Error processing recipe:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to process recipe' 
        });
    }
});

function extractRecipe(html, url) {
    const $ = cheerio.load(html);
    const recipe = {
        title: '',
        description: '',
        ingredients: [],
        steps: []
    };

    // Try to extract title
    recipe.title = $('h1').first().text().trim() ||
                   $('[class*="title"]').first().text().trim() ||
                   $('title').text().trim();

    // Try to extract description
    recipe.description = $('[class*="description"]').first().text().trim() ||
                         $('[itemprop="description"]').text().trim() ||
                         '';

    // Try multiple selectors for ingredients
    const ingredientSelectors = [
        '[itemprop="recipeIngredient"]',
        '[class*="ingredient"]',
        '[class*="ingredients"] li',
        'ul[class*="ingredient"] li',
        'ol[class*="ingredient"] li'
    ];

    for (const selector of ingredientSelectors) {
        const ingredients = $(selector);
        if (ingredients.length > 0) {
            ingredients.each((i, el) => {
                const text = $(el).text().trim();
                if (text && !recipe.ingredients.includes(text)) {
                    recipe.ingredients.push(text);
                }
            });
            if (recipe.ingredients.length > 0) break;
        }
    }

    // Try multiple selectors for instructions/steps
    const stepSelectors = [
        '[itemprop="recipeInstructions"] li',
        '[itemprop="recipeInstructions"] p',
        '[class*="instruction"] li',
        '[class*="step"] li',
        '[class*="direction"] li',
        'ol[class*="instruction"] li',
        'ol[class*="step"] li'
    ];

    for (const selector of stepSelectors) {
        const steps = $(selector);
        if (steps.length > 0) {
            steps.each((i, el) => {
                const text = $(el).text().trim();
                if (text && text.length > 10) { // Filter out very short text
                    recipe.steps.push(text);
                }
            });
            if (recipe.steps.length > 0) break;
        }
    }

    // If no structured steps found, try to find numbered lists
    if (recipe.steps.length === 0) {
        $('ol li, ul li').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 20 && text.length < 500) {
                recipe.steps.push(text);
            }
        });
    }

    return recipe;
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
