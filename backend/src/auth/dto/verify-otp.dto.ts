import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, {
    message: 'Invalid email format. Please use a valid email address',
  })
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;
}
