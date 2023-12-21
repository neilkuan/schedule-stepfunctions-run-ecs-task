import * as path from 'path';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface TaskJobProps {
  familyName: string;
}

export class TaskJob extends Construct {
  readonly taskDefinition: ecs.TaskDefinition;
  constructor(scope: Construct, id: string, props: TaskJobProps) {
    super(scope, id);

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'taskDefinition', {
      family: props.familyName,
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const fromAsset = new assets.DockerImageAsset(this, 'dockerImageAsset', {
      platform: assets.Platform.LINUX_AMD64,
      directory: path.join(__dirname, '../docker.d'),
    });
    const logGroup = new logs.LogGroup(this, 'logGroup', {
      logGroupName: '/aws/ecs/ecs-cron-job',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.taskDefinition.addContainer('container', {
      image: ecs.ContainerImage.fromDockerImageAsset(fromAsset),
      logging: new ecs.AwsLogDriver({
        logGroup,
        streamPrefix: 'ecs-cron-job',
      }),
    });


    this.taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['logs:*'],
      resources: [logGroup.logGroupArn],
    }));
  }
}