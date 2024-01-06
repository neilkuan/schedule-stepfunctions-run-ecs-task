import { awscdk } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'schedule-stepfunctions-run-ecs-task',
  projenrcTs: true,
  devDeps: [
    'esbuild',
    '@aws-sdk/client-ecs',
  ],
  gitignore: [
    'cdk.context.json',
  ],
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
    },
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['neilkuan'],
  },
});
project.synth();