const express = require('express');
const ky = require('ky-universal');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');

const port = process.env.PORT || 3000;
const token = process.env.TOKEN;

const app = express();
const web = new WebClient(token);

let channelUsersMap = {};
let userNameMap = {};

// Because this is an async function, it cannot return the response directly back to slack.
// Therefore, it uses response_url to send the response text back.
async function addUser(url, channel_id, user_id, alias) {
  let response = `User *${user_id}* is already in this channel.`;
  if (!channelUsersMap[channel_id]) channelUsersMap[channel_id] = [];
  if (!channelUsersMap[channel_id].includes(user_id)) {
    channelUsersMap[channel_id].push(user_id);

    if (!userNameMap[user_id]) {
      let name = alias;

      if (!name) {
        const res = await web.users.info({ user: user_id });
        name = res.user.real_name.split(' ')[0];
      }

      userNameMap[user_id] = name;
      response = `User *${user_id}* has been added to this channel as *${name}*.`;
    } else {
      response = `User *${user_id}* has been added to this channel.`;
    }
  }

  ky.post(url, { json: { text: response, response_type: 'in_channel' } });
  return true;
}

function removeUser(channel_id, user_id) {
  if (!user_id) return 'Please provide a user id.';
  if (!channelUsersMap[channel_id].includes(user_id)) return `User *${user_id}* does not exist in this channel map.`;

  channelUsersMap[channel_id] = channelUsersMap[channel_id].filter(user => user !== user_id);

  let noOccurrence = true;
  Object.values(channelUsersMap).forEach(users => {
    if (users.includes(user_id)) noOccurrence = false;
  });

  if (noOccurrence) delete userNameMap[user_id];

  return `Removed user *${user_id}* from this channel map.`;
}

function setAlias(user_id, alias) {
  if (!user_id) return 'Please provide a user id.';
  if (!alias) {
    delete userNameMap[user_id];
    return `Removed alias for *${user_id}*.`;
  }

  userNameMap[user_id] = alias;
  return `User *${user_id}* alias set to *${alias}*.`;
}

function listUsers(currentChannel) {
  let text = '';

  if (Object.values(channelUsersMap).reduce((acc, curr) => (curr && curr.length ? true : acc), false)) {
    text += '*Channels*\n';
    text += '```';
    Object.entries(channelUsersMap).forEach(([channel_id, users]) => {
      if (users.length) {
        text += `${channel_id}:`;

        if (currentChannel === channel_id) text += ' (HERE)';
        text += '\n';

        users.forEach(user_id => {
          text += `  ${user_id}: ${userNameMap[user_id]}\n`;
        });
      }
    });
    text += '```';
  } else {
    text += 'No channels have been set.';
  }

  if (Object.values(userNameMap).length) {
    text += '\n*Users*\n';
    text += '```';
    Object.entries(userNameMap).forEach(([user_id, alias]) => {
      text += `  ${user_id}: ${alias}\n`;
    });
    text += '```';
  } else {
    text += '\nNo aliases have been set.';
  }

  return text;
}

function pickRandomUser(channel_id, user_id) {
  if (channelUsersMap[channel_id]) {
    // Makes sure the callee does not get picked.
    const filtered = channelUsersMap[channel_id].filter(user => user !== user_id);

    if (!filtered.length) return 'You\'re the only person in this channel.';
    const chosenId = filtered[Date.now() % filtered.length];
    return userNameMap[chosenId] || chosenId;
  }

  return 'There are no users in this channel.';
}

function resetHard() {
  channelUsersMap = {};
  userNameMap = {};

  return 'Successfully reset all channels and users.';
}

function resetChannel(channel_id) {
  if (channelUsersMap[channel_id]) {
    // Becasue removeUser alters the original array, creates a temporary copy to iterate over without being affected.
    const copy = [...channelUsersMap[channel_id]];
    copy.forEach(user_id => removeUser(channel_id, user_id));

    return 'Successfully reset this channel.';
  }

  return 'There are no users in this channel.';
}

function help() {
  const add = '- add [\'me\' | user_id] [alias]\n  Adds a user into the current channel. If no alias is provided, first name will be used as alias.';
  const remove = '- remove [\'me\' | user_id]\n  Removes a user from the current channel. If the user doesn\'t belong in any other channels, the alias is also removed.';
  const alias = '- alias [\'me\' | user_id] [alias]\n  Sets a user\'s alias. This alias is shared across all channels. If no alias is passed in, it removes the user\'s alias.';
  const ls = '- ls\n  Shows the channels/aliases mapping.';
  const reset = '- reset [\'hard\']\n  Resets the current channel\'s users. \'hard\' keyword resets all channels and aliases.';
  return `\`\`\`${[add, remove, alias, ls, reset].join('\n\n')}\`\`\``;
}

function handler(body) {
  const { text, channel_id, user_id, channel_name, response_url } = body;
  const [command, arg1, arg2] = text.split(' ');

  switch (command) {
    case 'add': {
      if (channel_name === 'directmessage') return 'Direct Messages cannot be used.';
      if (!arg1) return 'Please provide a user id.';
      return addUser(
        response_url,
        channel_id,
        arg1 !== 'me' ? arg1 : user_id,
        arg2
      );
    }

    case 'remove': {
      return removeUser(
        channel_id,
        arg1 !== 'me' ? arg1 : user_id,
      );
    }

    case 'alias': {
      return setAlias(
        arg1 !== 'me' ? arg1 : user_id,
        arg2,
      );
    }

    case 'ls': {
      return listUsers(channel_id);
    }

    case 'help': {
      return help();
    }

    case 'reset': {
      if (arg1 === 'hard') return resetHard();
      return resetChannel(channel_id);
    }

    default: {
      return pickRandomUser(channel_id, user_id);
    }
  }
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/', (req, res) => {
  res.send({
    response_type: 'in_channel',
    text: handler(req.body) || 'Something went wrong...',
  });
});

app.listen(port, () => console.log(`Server listening at http://localhost:${port}`));
