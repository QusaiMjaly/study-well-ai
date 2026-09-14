# Student Wellness AI

Create a modern AI-powered university student wellness web application called StudentFitAI.

Tech stack:

- React

- TypeScript

- Tailwind CSS

- Supabase

- Gemini AI

Connect the app to my existing Supabase project.

Use Supabase Authentication with email/password.

Use these existing tables:

- profiles

- goals

- schedules

- meal_plans

- workout_plans

- progress

Application flow:

1. Landing Page

- Modern hero section

- Explain the app

- CTA buttons for signup/login

2. Authentication

- Login page

- Signup page

3. Onboarding Form

Collect:

- Full name

- Age

- Gender

- Height

- Weight

- Activity level

Save to profiles table.

4. Academic Schedule Upload

Allow users to:

- Upload a university timetable image

- Save image to Supabase Storage bucket:

  schedule-images

Save image URL in schedules table.

5. Goals & Preferences

Collect:

- Goal type

  - Lose weight

  - Gain muscle

  - Maintain weight

- Workout days per week

- Food preferences

- Allergies

Save to goals table.

6. AI Plan Generation

Use Gemini API with environment variable:

GEMINI_API_KEY

Analyze:

- user profile

- activity level

- goals

- uploaded schedule

Generate:

- weekly workout plan

- weekly meal plan

Return structured JSON.

Save:

- workout plan to workout_plans table

- meal plan to meal_plans table

7. Dashboard

Create tabs:

- Meals

- Workouts

- Progress

- Profile

Display plans by days of the week.

8. Progress Tracking

Allow users to:

- Enter current weight

- Add notes

- Track progress history

Save to progress table.

Design requirements:

- Modern dark/light UI

- Mobile responsive

- Clean student-focused interface

- Animated loading states

- Beautiful cards and charts

Security:

- Each user can only access their own data

- Use Supabase auth session

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://study-well-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e6dbe462-2bc1-4163-b1ed-3098c6e08f19).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
