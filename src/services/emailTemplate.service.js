/**
 * Email Template Rendering Service
 * Compiles email templates with variables using Handlebars-like syntax
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');

const TEMPLATES_DIR = path.join(__dirname, '../templates/emails');
const templateCache = new Map();

/**
 * Load and cache a template file
 * @param {string} templateName - Name of the template (without .html)
 * @returns {string} - Template content
 */
const loadTemplate = (templateName) => {
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName);
    }

    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template not found: ${templateName}`);
    }

    const content = fs.readFileSync(templatePath, 'utf-8');
    templateCache.set(templateName, content);
    return content;
};

/**
 * Load the base layout template
 * @returns {string} - Base layout content
 */
const loadBaseLayout = () => {
    return loadTemplate('layouts/base');
};

/**
 * Simple template variable replacement
 * Supports: {{variable}}, {{#if condition}}...{{/if}}, {{#if condition}}...{{else}}...{{/if}}
 * @param {string} template - Template string
 * @param {Object} variables - Variables to inject
 * @returns {string} - Rendered template
 */
const compileTemplate = (template, variables) => {
    let result = template;

    // Handle {{#if variable}}...{{else}}...{{/if}} blocks
    result = result.replace(
        /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (match, varName, ifContent, elseContent) => {
            return variables[varName] ? ifContent : elseContent;
        }
    );

    // Handle {{#if variable}}...{{/if}} blocks (without else)
    result = result.replace(
        /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (match, varName, content) => {
            return variables[varName] ? content : '';
        }
    );

    // Handle {{{variable}}} - Unescaped content
    result = result.replace(/\{\{\{(\w+)\}\}\}/g, (match, varName) => {
        const value = variables[varName];
        return (value === undefined || value === null) ? '' : value;
    });

    // Handle {{variable}} - Escaped content (default)
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = variables[varName];
        if (value === undefined || value === null) {
            return '';
        }
        // Escape HTML in user-provided content
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    });

    return result;
};

/**
 * Generate plain text version from HTML
 * @param {string} html - HTML content
 * @returns {string} - Plain text version
 */
const htmlToText = (html) => {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .trim();
};

/**
 * Render an email template with variables
 * @param {string} templateName - Template name (e.g., 'passwordReset', 'verifyEmail')
 * @param {Object} variables - Template variables
 * @returns {{html: string, text: string}} - Rendered HTML and plain text
 */
const renderTemplate = (templateName, variables = {}) => {
    try {
        const baseLayout = loadBaseLayout();
        const contentTemplate = loadTemplate(templateName);

        // Add common variables
        const allVariables = {
            ...variables,
            year: new Date().getFullYear(),
            frontendUrl: config.forgotPassword?.frontendUrl || 'https://indeal.com',
        };

        // Compile content template first
        const compiledContent = compileTemplate(contentTemplate, allVariables);

        // Wrap in base layout
        const fullHtml = compileTemplate(baseLayout, {
            ...allVariables,
            content: compiledContent,
        });

        // Generate plain text version
        const text = htmlToText(fullHtml);

        return { html: fullHtml, text };
    } catch (error) {
        logger.error({ err: error, templateName }, 'Failed to render email template');
        throw error;
    }
};

/**
 * Clear template cache (useful for development)
 */
const clearCache = () => {
    templateCache.clear();
    logger.debug('Email template cache cleared');
};

module.exports = {
    renderTemplate,
    clearCache,
};
