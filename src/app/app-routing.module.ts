import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule),
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule),
  },
  {
    path: 'create-account',
    loadChildren: () =>
      import('./create-account/create-account.module').then(
        m => m.CreateAccountPageModule
      ),
  },
  {
    path: '',
    redirectTo: 'home', // Si no deseas que la app vaya directamente al home, cámbialo a 'login'
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.page').then(m => m.DashboardPage), // standalone component
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
  },  {
    path: 'reset-password',
    loadChildren: () => import('./reset-password/reset-password.module').then( m => m.ResetPasswordPageModule)
  }

];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
