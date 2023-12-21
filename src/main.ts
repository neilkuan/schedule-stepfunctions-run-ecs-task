import { App, Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sftasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { TaskJob } from './task-job';
export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'demoVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
      }],
    });

    const ecsCronJobSG = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      allowAllOutbound: true,
      securityGroupName: 'ecs-cron-job',
    });
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'ecs-cron-job',
      vpc,
    });
    const task = new TaskJob(this, 'TaskJob', {
      familyName: 'ecs-cron-job',
    });

    const listTasks = new sftasks.CallAwsService(this, 'ListTasks', {
      service: 'ecs',
      action: 'listTasks',
      parameters: {
        Family: task.taskDefinition.family,
        Cluster: cluster.clusterName,
        DesiredStatus: 'RUNNING',
      },
      iamResources: [
        cluster.clusterArn,
        task.taskDefinition.taskDefinitionArn,
      ],
      taskTimeout: stepfunctions.Timeout.duration(Duration.seconds(10)),
      resultSelector: {
        'taskArns.$': '$.TaskArns',
      },
      outputPath: '$.taskArns',
    });


    const choice = new stepfunctions.Choice(this, 'Need to run ECS task ?!', {
      inputPath: '$.taskArns',
    });

    const passItems = new stepfunctions.Pass(this, 'mapItems', {
    });
    passItems.next(new sftasks.EcsRunTask(this, 'EcsRunTask', {
      cluster: cluster,
      taskDefinition: task.taskDefinition,
      securityGroups: [ecsCronJobSG],
      subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
      launchTarget: sftasks.EcsFargateLaunchTarget,
      assignPublicIp: true,
    }));


    const definition = stepfunctions.Chain.start(listTasks)
      .next(choice.
        when(stepfunctions.Condition.numberLessThan(stepfunctions.JsonPath.arrayLength('$.taskArns'), 1),
          new stepfunctions.Succeed(this, 'Not need start ECS Task, Done'))
        .when(stepfunctions.Condition.numberGreaterThanEquals(stepfunctions.JsonPath.arrayLength('$.taskArns'), 1),
          passItems),
      );

    const machine = new stepfunctions.StateMachine(this, 'StateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
    });
    new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.rate(Duration.minutes(2)),
      targets: [new targets.SfnStateMachine(machine)],
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'schedule-stepfunctions-run-ecs-task-dev', { env: devEnv });

app.synth();

//.tasks[0].containers[0].exitCode