const bodyParser = require('body-parser');
const GitHubApi = require('github');

const WebClient = require('@slack/client').WebClient;

const token = process.env.OLD_MODEL_SLACK_TEST_TOKEN;
const web = new WebClient(token);

const {
  matchMetaDataStatetoIssueMessage,
  issueOpened,
  issueClosed,
  issueReopened,
} = require('./lib/issues');

const unfurl = require('./lib/unfurl');

const {
  pullRequestOpened,
  status,
} = require('./lib/pullRequests');

module.exports = (robot) => {
  robot.on('issues.opened', issueOpened);
  robot.on([
    'issues.labeled',
    'issues.unlabeled',
    'issues.assigned',
    'issues.unassigned',
    'issue_comment',
  ], matchMetaDataStatetoIssueMessage);

  robot.on('issues.closed', issueClosed);
  robot.on('issues.reopened', issueReopened);
  robot.on('pull_request.opened', pullRequestOpened);
  robot.on('status', status);

  const app = robot.route();
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.post('/slack/', async (req, res) => {
    if (req.body.token === process.env.OLD_MODEL_SLACK_SECRET_TOKEN) {
      robot.log({body: req.body});
      const {type, challenge} = req.body;
      if (type === 'url_verification') {
        res.json({ challenge });
      } else if (req.body.event.type === 'link_shared') {
        const github = new GitHubApi();
        const unfurls = {};
        req.body.event.links.forEach(async link => {
          unfurls[link.url] = await unfurl(github, link.url);
          robot.log.trace(unfurls, 'Unfurling links');
          web.chat.unfurl(
            req.body.event.message_ts,
            req.body.event.channel,
            unfurls,
            function(err, res) {
              if (err) {
                robot.log.error(err);
              } else {
                robot.log.trace(res, 'Unfurl complete')
              }
            });
        });
      } else {
        console.log(type);
      }
    } else {
      res.status(401).json({ ok: false });
    }
  });
};