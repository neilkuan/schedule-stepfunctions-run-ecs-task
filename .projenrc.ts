import { awscdk } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'schedule-stepfunctions-run-ecs-task',
  projenrcTs: true,

  // deps: [],
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'esbuild',
    '@aws-sdk/client-ecs',
  ],
  gitignore: [
    'cdk.context.json',
  ],
});
project.synth();