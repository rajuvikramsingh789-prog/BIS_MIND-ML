const { GEMINI_API_KEY } = require('../config/env');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (err) {
        console.warn('Gemini AI initialization error in LLM service:', err.message);
    }
}

class LLMService {
    async generateGroundedAnswer({ query, contextChunks, conversationHistory = [] }) {
        const contextText = contextChunks.map((c, i) => 
            `[EVIDENCE Source #${i+1}]: IS Standard / Doc: ${c.is_number || 'Official Guidance'}\nTitle: ${c.doc_title || ''}\nClause: ${c.clause_no || 'N/A'}\nContent: ${c.content}\nSource URL: ${c.source_url || 'https://www.bis.gov.in/'}`
        ).join('\n\n');

        const systemPrompt = `You are "Know Your BIS", an AI assistant for the Bureau of Indian Standards (BIS).
Your primary mandate is to provide accurate, evidence-backed answers regarding Indian Standards, BIS Certification (ISI Mark, CRS, FMCS), Hallmarking (HUID), Quality Control Orders (QCOs), Testing Requirements, and BIS Laboratories.

CRITICAL GROUNDING RULES:
1. Rely strictly on the provided EVIDENCE.
2. NEVER fabricate IS numbers, Clause numbers, testing requirements, or government notifications.
3. If sufficient evidence is not available in the context, explicitly inform the user.
4. Cite official standards (e.g. [IS 1786:2008 Clause 4.1], [IS 14543:2004], [Toys QCO 2020]) whenever providing specific figures, limits, or requirements.
5. Format your output using clear Markdown headings, bullet points, and tables where appropriate.
6. Clearly distinguish between MANDATORY Quality Control Orders (QCO) and voluntary standards.

EVIDENCE CONTEXT:
${contextText || 'No direct evidence chunks found.'}
`;

        if (genAI && GEMINI_API_KEY) {
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    systemInstruction: systemPrompt
                });

                const formattedHistory = conversationHistory.slice(-6).map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }));

                const chat = model.startChat({ history: formattedHistory });
                const result = await chat.sendMessage(`User Question: ${query}`);
                const responseText = result.response.text();
                return { text: responseText, source: 'gemini' };
            } catch (err) {
                console.warn('Gemini API call failed, falling back to grounded evidence synthesis:', err.message);
            }
        }

        // Deterministic Grounded Synthesis Fallback when API Key is absent or fails
        return {
            text: this._synthesizeGroundedResponse(query, contextChunks),
            source: 'grounded-engine'
        };
    }

    async generateProductRecommendation({ productDescription, matchedStandards }) {
        if (!matchedStandards || matchedStandards.length === 0) {
            return {
                recommendationText: `No specific Indian Standard was found matching "${productDescription}" in the database. Please verify with the official BIS Standards portal at https://standardsbis.bsbedge.com/.`,
                confidence: 0.3
            };
        }

        const primary = matchedStandards[0];
        const contextSummary = matchedStandards.map(s => 
            `• ${s.isNumber}: ${s.title} (${s.isMandatory ? 'MANDATORY under ' + (s.qcoOrder || 'QCO') : 'Voluntary Scheme'})`
        ).join('\n');

        const systemPrompt = `You are a BIS Product Compliance Analyst.
Analyze the product description: "${productDescription}" and provide a structured compliance breakdown based on these verified Indian Standards:
${contextSummary}

Rules:
- State whether the standard is mandatory or voluntary.
- List required testing parameters.
- Provide step-by-step licensing guidance.
- Cite official standard numbers accurately.
`;

        if (genAI && GEMINI_API_KEY) {
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `${systemPrompt}\nProvide a structured, helpful analysis.`;
                const result = await model.generateContent(prompt);
                return {
                    recommendationText: result.response.text(),
                    confidence: primary.isMandatory ? 0.95 : 0.85
                };
            } catch (err) {
                console.warn('Gemini API recommendation error, using deterministic synthesis:', err.message);
            }
        }

        // Local synthesis for recommendation
        let response = `### BIS Standard & Compliance Recommendation for "${productDescription}"\n\n`;
        response += `#### Recommended Primary Indian Standard\n`;
        response += `**[${primary.isNumber}:${primary.year}](${primary.officialUrl})** - *${primary.title}*\n\n`;
        
        response += `#### 1. Mandatory QCO & Legal Status\n`;
        if (primary.isMandatory) {
            response += `> [!IMPORTANT]\n`;
            response += `> **MANDATORY CERTIFICATION REQUIRED**: Covered under **${primary.qcoOrder}** enforced by ${primary.enforcingMinistry || 'Government of India'}. It is illegal to manufacture, import, or sell this item without a valid BIS License / Standard Mark.\n\n`;
        } else {
            response += `> [!NOTE]\n`;
            response += `> **Voluntary Certification**: Currently a voluntary quality benchmark standard under BIS Scheme I.\n\n`;
        }

        response += `#### 2. Applicable BIS Certification Scheme\n`;
        response += `**${primary.scheme}**\n\n`;

        response += `#### 3. Key Laboratory & Quality Testing Requirements\n`;
        if (primary.testingRequirements && primary.testingRequirements.length > 0) {
            primary.testingRequirements.forEach(req => {
                response += `- ${req}\n`;
            });
        }

        response += `\n#### 4. Authorized BIS Testing Laboratories\n`;
        if (primary.labCapabilities && primary.labCapabilities.length > 0) {
            primary.labCapabilities.forEach(lab => {
                response += `- ${lab}\n`;
            });
        }

        response += `\n#### 5. Recommended Next Steps for Manufacturers\n`;
        response += `1. Access official specification details on [BIS Portal](${primary.officialUrl}).\n`;
        response += `2. Ensure factory internal quality control and testing equipment conform to ${primary.isNumber}.\n`;
        response += `3. File an online license application on [Manakonline Portal](https://www.manakonline.in/).\n`;

        return {
            recommendationText: response,
            confidence: primary.isMandatory ? 0.96 : 0.88
        };
    }

    _synthesizeGroundedResponse(query, contextChunks) {
        if (!contextChunks || contextChunks.length === 0) {
            return `I could not find specific official evidence in the BIS knowledge base regarding your query "${query}".\n\nPlease check the official Bureau of Indian Standards portal at [https://www.bis.gov.in/](https://www.bis.gov.in/) or search the standards catalog at [https://standardsbis.bsbedge.com/](https://standardsbis.bsbedge.com/).`;
        }

        let answer = `### Official BIS Evidence Summary\n\n`;
        answer += `Based on official Bureau of Indian Standards documentation retrieved for your inquiry:\n\n`;

        contextChunks.forEach((chunk, i) => {
            const isNo = chunk.is_number ? `**${chunk.is_number}**` : 'Official BIS Guidance';
            const clause = chunk.clause_no ? `(Clause ${chunk.clause_no})` : '';
            answer += `#### ${i + 1}. ${isNo} ${clause}\n`;
            answer += `${chunk.content}\n\n`;
        });

        answer += `---\n*Official Source References:* Verified from [Bureau of Indian Standards Repository](https://www.bis.gov.in/).`;
        return answer;
    }
}

module.exports = new LLMService();
