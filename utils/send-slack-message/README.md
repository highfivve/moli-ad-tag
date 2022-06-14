# Send Slack messages

Mini library to send slack messages containing ad tag release info.

## Usage

```typescript
import { sendSlackMessage } from '@highfivve/utils-send-slack-message';

await sendSlackMessage({
  release: {
    version: 42,
    changelog: ['Found the answer to all problems']
  },
  publisherName: 'a-publisher',
  slackChannel: 'a-publisher-comm'
});
```
