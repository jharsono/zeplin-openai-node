require('dotenv').config();
const Openai = require('openai');

const { OPENAI_API_KEY, ZEPLIN_API_KEY, ZEPLIN_PROJECT_ID } = process.env;

const openaiclient = new Openai({ apiKey: OPENAI_API_KEY });

const zeplinBaseUrl = 'https://api.zeplin.dev';

async function getProjectScreens({ projectId, sectionId, sort }) {
  const url = `${zeplinBaseUrl}/v1/projects/${projectId}/screens`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ZEPLIN_API_KEY}`,
    },
  });

  const data = await response.json();
  return data;
}

const internalFunctions = {
  getProjectScreens,
};

const functions = [
  {
    type: 'function',
    function: {
      name: 'getProjectScreens',
      description: 'Gets the screens in Zeplin',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The id of the project in mongodb object id format e.g. 65ddec7fe6d474b19d2bc5f1',
          },
          sectionId: {
            type: 'string',
            description: 'The section id to use. If specified returns the screens in this section, otherwise returns all screens in the project.',
          },
          sort: {
            type: 'string',
            enum: ['created', 'section'],
            description: "The order to return the screens in. If 'created' returns the screens in the order they were created, if 'section' returns the screens in the order they are in the section.",
          },
        },
        required: ['projectId'],
      },
    },
  },
];

async function start() {
  const messages = [];
  messages.push({ role: 'system', content: "Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous." });
  messages.push({ role: 'user', content: `How many screens are there in my project? My project id is ${ZEPLIN_PROJECT_ID}` });
  const response = await openaiclient.chat.completions.create({
    messages,
    tools: functions,
    tool_choice: 'auto',
    model: 'gpt-4',
    temperature: 0.1,
    max_tokens: 50,
  });
    // If the response is a tool call, call the function and return the result
  if (response.choices[0].finish_reason === 'tool_calls') {
    const functionName = response.choices[0].message.tool_calls[0].function.name;
    const args = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
    // Call the function
    const result = await internalFunctions[functionName](args);
    messages.push({ role: 'system', content: `The result of the API call is ${JSON.stringify(result)}` });
    const response2 = await openaiclient.chat.completions.create({
      messages,
      tools: functions,
      tool_choice: 'auto',
      model: 'gpt-4',
      temperature: 0.1,
      max_tokens: 50,
    });
    console.log(response2.choices[0].message.content);
  } else {
    // If the response is a message, return the message
    console.log(response.choices[0].message);
  }
  console.log(response.choices[0].message);
}

start();
