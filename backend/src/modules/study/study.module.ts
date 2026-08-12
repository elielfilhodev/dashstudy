import { Module } from '@nestjs/common';
import { AgendaController } from '../agenda/agenda.controller';
import { AgendaService } from '../agenda/agenda.service';
import { GamificationController } from '../gamification/gamification.controller';
import { GamificationService } from '../gamification/gamification.service';
import { GoalsController } from '../goals/goals.controller';
import { GoalsService } from '../goals/goals.service';
import { SubjectsController } from '../subjects/subjects.controller';
import { SubjectsService } from '../subjects/subjects.service';
import { TasksController } from '../tasks/tasks.controller';
import { TasksService } from '../tasks/tasks.service';

@Module({
  controllers: [
    SubjectsController,
    TasksController,
    GoalsController,
    AgendaController,
    GamificationController,
  ],
  providers: [
    SubjectsService,
    TasksService,
    GoalsService,
    AgendaService,
    GamificationService,
  ],
})
export class StudyModule {}
