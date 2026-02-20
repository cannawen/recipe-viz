/**
 * Generates a Mermaid flowchart from recipe data
 * Similar to the lemon meringue pie flowchart structure
 */
function generateMermaidFlowchart(recipe) {
    const { ingredients, steps } = recipe;
    
    if (!ingredients || ingredients.length === 0) {
        return 'graph TD\n    A[No recipe data]';
    }

    // Parse steps to identify processes and their inputs/outputs
    const processes = parseSteps(steps, ingredients);
    
    // Build Mermaid diagram - using LR (left to right) to match the image style
    let mermaid = 'flowchart LR\n';
    
    // Create ingredient nodes map
    const ingredientNodes = {};
    const ingredientNames = extractIngredientNames(ingredients);
    
    ingredientNames.forEach((ing, idx) => {
        const nodeId = `ing${idx}`;
        const cleanIng = cleanNodeName(ing);
        ingredientNodes[ing] = nodeId;
        mermaid += `    ${nodeId}["${cleanIng}"]\n`;
    });

    // Add process nodes
    const processNodes = {};
    processes.forEach((process, idx) => {
        const nodeId = `proc${idx}`;
        processNodes[idx] = nodeId;
        const cleanProcess = cleanNodeName(process.name);
        mermaid += `    ${nodeId}["${cleanProcess}"]\n`;
    });

    // Connect ingredients to processes
    processes.forEach((process, procIdx) => {
        const procNodeId = processNodes[procIdx];
        
        // Find which ingredients are used in this process
        process.inputIngredients.forEach(ing => {
            const ingNodeId = findIngredientNode(ing, ingredientNodes, ingredientNames);
            if (ingNodeId) {
                mermaid += `    ${ingNodeId} --> ${procNodeId}\n`;
            }
        });
    });

    // Connect processes to each other (based on outputs)
    processes.forEach((process, procIdx) => {
        const procNodeId = processNodes[procIdx];
        
        // Connect to next process if this process produces something used by next
        if (procIdx < processes.length - 1) {
            const nextProcNodeId = processNodes[procIdx + 1];
            const outputName = process.output || `intermediate ${procIdx + 1}`;
            const intermediateNodeId = `int${procIdx}`;
            
            mermaid += `    ${procNodeId} --> ${intermediateNodeId}["${cleanNodeName(outputName)}"]\n`;
            mermaid += `    ${intermediateNodeId} --> ${nextProcNodeId}\n`;
        }
    });

    // Add final output
    const finalOutputId = 'final';
    const lastProcId = processNodes[processes.length - 1];
    if (lastProcId) {
        mermaid += `    ${lastProcId} --> ${finalOutputId}["finished dish"]\n`;
    }

    return mermaid;
}

function parseSteps(steps, allIngredients) {
    if (!steps || steps.length === 0) {
        return [];
    }

    const processes = [];
    const ingredientNames = extractIngredientNames(allIngredients);
    
    steps.forEach((step, idx) => {
        const stepText = step.toLowerCase();
        
        // Extract process name (usually the first verb phrase)
        const processName = extractProcessName(step);
        
        // Try to identify input ingredients mentioned in the step
        const inputIngredients = extractIngredientsFromStep(step, ingredientNames);
        
        // Try to identify output (what is produced)
        const output = extractOutput(step);
        
        processes.push({
            name: processName || `Step ${idx + 1}`,
            inputIngredients: inputIngredients,
            output: output,
            originalStep: step
        });
    });

    return processes;
}

function extractIngredientNames(ingredients) {
    // Extract just the ingredient names, removing quantities and measurements
    return ingredients.map(ing => {
        // Remove common measurement patterns
        let name = ing
            .replace(/^\d+\s*[\/\d\s]*\s*(cup|tbsp|tsp|oz|lb|g|kg|ml|l|piece|pieces|whole|halves|cloves?|slices?|dashes?|pinches?|drops?)\s+/i, '')
            .replace(/^\d+\s*[\/\d\s]*\s*/i, '')
            .replace(/\s*\([^)]*\)\s*/g, '') // Remove parenthetical notes
            .trim();
        
        // If still starts with number, try to remove it
        name = name.replace(/^\d+\s*/, '');
        
        return name || ing; // Fallback to original if empty
    });
}

function extractProcessName(step) {
    // Look for common cooking verbs
    const cookingVerbs = [
        'mix', 'combine', 'add', 'stir', 'whisk', 'beat', 'blend',
        'cook', 'bake', 'fry', 'sauté', 'boil', 'simmer', 'roast',
        'chop', 'dice', 'slice', 'mince', 'grate', 'peel',
        'separate', 'divide', 'cut', 'prepare', 'make', 'create',
        'pour', 'transfer', 'place', 'arrange', 'layer', 'spread',
        'roll', 'fold', 'knead', 'press', 'form', 'shape',
        'season', 'salt', 'pepper', 'flavor', 'marinate'
    ];

    const words = step.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i].replace(/[^a-z]/g, '');
        if (cookingVerbs.includes(word)) {
            // Get the verb and next few words as process name
            const processWords = words.slice(i, Math.min(i + 4, words.length));
            return processWords.join(' ').replace(/[^\w\s]/g, ' ').trim();
        }
    }

    // Fallback: first 4-6 words
    return step.split(/\s+/).slice(0, 6).join(' ').replace(/[^\w\s]/g, ' ').trim();
}

function extractIngredientsFromStep(step, ingredientNames) {
    const stepLower = step.toLowerCase();
    const foundIngredients = [];
    
    // Match against actual ingredient names from the recipe
    ingredientNames.forEach(ingName => {
        const ingLower = ingName.toLowerCase();
        // Check if ingredient name appears in step
        // Use word boundaries to avoid partial matches
        const words = ingLower.split(/\s+/);
        if (words.length === 1) {
            // Single word ingredient - check for whole word match
            const regex = new RegExp(`\\b${words[0]}\\b`, 'i');
            if (regex.test(step)) {
                foundIngredients.push(ingName);
            }
        } else {
            // Multi-word ingredient - check if all words appear
            const allWordsPresent = words.every(word => stepLower.includes(word));
            if (allWordsPresent) {
                foundIngredients.push(ingName);
            }
        }
    });

    return foundIngredients;
}

function extractOutput(step) {
    // Look for output indicators
    const outputPatterns = [
        /(?:to make|to create|to form|to produce)\s+([^,\.]+)/i,
        /(?:into|as)\s+([^,\.]+)/i,
        /(?:result|yields?|produces?)\s+([^,\.]+)/i
    ];

    for (const pattern of outputPatterns) {
        const match = step.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return null;
}

function findIngredientNode(ingredient, ingredientNodes, allIngredients) {
    const ingLower = ingredient.toLowerCase();
    
    // Direct match
    for (const [key, nodeId] of Object.entries(ingredientNodes)) {
        if (key.toLowerCase().includes(ingLower) || ingLower.includes(key.toLowerCase())) {
            return nodeId;
        }
    }

    // Partial match
    for (let i = 0; i < allIngredients.length; i++) {
        if (allIngredients[i].toLowerCase().includes(ingLower)) {
            return `ing${i}`;
        }
    }

    return null;
}

function cleanNodeName(name) {
    if (!name) return '';
    // Remove extra whitespace, limit length, escape quotes
    return name
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 40)
        .replace(/"/g, "'");
}

module.exports = { generateMermaidFlowchart };
