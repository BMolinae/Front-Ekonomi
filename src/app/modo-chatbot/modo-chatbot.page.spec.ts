import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModoChatbotPage } from './modo-chatbot.page';

describe('ModoChatbotPage', () => {
  let component: ModoChatbotPage;
  let fixture: ComponentFixture<ModoChatbotPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModoChatbotPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
